"use client";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, Session, SessionOrder } from "@/lib/types";
import { priceForDuration, applyCustomerBuffer } from "@/lib/pricing";
import { minutesBetween } from "@/lib/format";

const sb = () => createClient();

export async function getSession(id: string): Promise<Session> {
  const { data, error } = await sb()
    .from("sessions")
    .select(
      "*, room:rooms(*), customer:customers(*), subscriber:subscribers(*, plan:plans(*))"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Session;
}

export async function getOrdersForSession(sessionId: string): Promise<SessionOrder[]> {
  const { data, error } = await sb()
    .from("session_orders")
    .select("*")
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as SessionOrder[];
}

export async function removeOrder(orderId: string) {
  // Soft delete + restore stock
  const supabase = sb();
  const { data: order, error: e0 } = await supabase
    .from("session_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (e0) throw e0;
  const { error: e1 } = await supabase
    .from("session_orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orderId);
  if (e1) throw e1;
  // Restore stock
  const { data: item } = await supabase.from("items").select("stock").eq("id", order.item_id).single();
  if (item) {
    await supabase
      .from("items")
      .update({ stock: item.stock + order.quantity })
      .eq("id", order.item_id);
    await supabase.from("stock_movements").insert({
      item_id: order.item_id,
      quantity: order.quantity,
      reason: `refund:${order.session_id}`,
    });
  }
}

/**
 * Returns the next_session_note from the most recent CLOSED session for a
 * customer or subscriber, but only if no newer active/open session exists
 * (i.e., the note is for the upcoming next session).
 */
export async function getLastSessionNote(opts: {
  customer_id?: string;
  subscriber_id?: string;
}): Promise<string | null> {
  const supabase = sb();
  let q = supabase
    .from("sessions")
    .select("next_session_note, status, started_at")
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(2);

  if (opts.customer_id) q = q.eq("customer_id", opts.customer_id);
  else if (opts.subscriber_id) q = q.eq("subscriber_id", opts.subscriber_id);
  else return null;

  const { data } = await q;
  if (!data || data.length === 0) return null;

  // The most recent session: if it's active, note is stale (they've already started their next session).
  const latest = data[0];
  if (latest.status === "active") return null;

  // It's closed — return the note (could be null if none was left).
  return latest.next_session_note ?? null;
}

/**
 * Close a session and create an invoice.
 * For subscribers, session_price = 0 (they've prepaid) and hours_remaining decrements.
 */
export async function checkoutSession(opts: {
  sessionId: string;
  paymentMethod: string;
  note?: string;
}): Promise<Invoice> {
  const supabase = sb();
  const session = await getSession(opts.sessionId);
  if (session.status === "closed") {
    // Return the existing invoice
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("session_id", session.id)
      .is("deleted_at", null)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as Invoice;
  }

  const endedAt = new Date().toISOString();
  const isSubscriber = !!session.subscriber_id;

  // ── Build the final list of segments ────────────────────────────────────
  // Existing closed segments from previous room switches
  const closedSegments = (session.session_segments ?? []) as import("@/lib/types").SessionSegment[];

  // The current (still-open) segment started after the last closed segment ended
  const currentSegmentStart = closedSegments.length > 0
    ? closedSegments[closedSegments.length - 1].ended_at
    : session.started_at;
  const currentMinutes = minutesBetween(currentSegmentStart, endedAt);
  const currentPrice = isSubscriber ? 0 : priceForDuration(session.room!, currentMinutes);

  const currentSegment: import("@/lib/types").SessionSegment = {
    room_id: session.room_id!,
    room_name: session.room?.name ?? "Room",
    started_at: currentSegmentStart,
    ended_at: endedAt,
    duration_minutes: currentMinutes,
    price: currentPrice,
  };
  const allSegments = [...closedSegments, currentSegment];

  // Total session time and price across all segments
  const totalMinutes = allSegments.reduce((s, seg) => s + seg.duration_minutes, 0);
  const sessionPrice = allSegments.reduce((s, seg) => s + seg.price, 0);

  const orders = await getOrdersForSession(session.id);
  const ordersAmount = orders.reduce((s, o) => s + Number(o.line_total), 0);
  const total = sessionPrice + ordersAmount;

  // Build invoice items snapshot — one line per room segment
  const items: Invoice["items"] = [];
  if (isSubscriber) {
    // Subscribers: one combined line, no charge
    items.push({
      name: allSegments.length > 1
        ? allSegments.map((seg) => seg.room_name).join(" → ") + " (subscriber)"
        : `${currentSegment.room_name} session (subscriber)`,
      qty: 1,
      price: 0,
      total: 0,
    });
  } else {
    // Walk-in customers: one line per segment
    for (const seg of allSegments) {
      const hoursLabel = applyCustomerBuffer(seg.duration_minutes);
      const label = hoursLabel === 0
        ? `${seg.room_name} (free — under 15 min)`
        : `${seg.room_name} (${hoursLabel}h)`;
      items.push({ name: label, qty: 1, price: seg.price, total: seg.price });
    }
  }
  for (const o of orders) {
    items.push({
      name: o.item_name,
      qty: o.quantity,
      price: Number(o.unit_price),
      total: Number(o.line_total),
    });
  }

  // Close session — persist final segments and total duration
  const { error: e1 } = await supabase
    .from("sessions")
    .update({
      status: "closed",
      ended_at: endedAt,
      duration_minutes: totalMinutes,
      session_price: sessionPrice,
      session_segments: allSegments,
      next_session_note: opts.note?.trim() || null,
    })
    .eq("id", session.id);
  if (e1) throw e1;

  // Decrement subscriber hours based on total time
  if (isSubscriber && session.subscriber) {
    const used = totalMinutes / 60;
    const remaining = Math.max(0, Number(session.subscriber.hours_remaining) - used);
    await supabase
      .from("subscribers")
      .update({ hours_remaining: remaining })
      .eq("id", session.subscriber.id);
  }

  const customerName = session.customer?.name ?? session.subscriber?.name ?? "—";
  const { data: invoice, error: e2 } = await supabase
    .from("invoices")
    .insert({
      kind: "session",
      session_id: session.id,
      subscriber_id: session.subscriber_id,
      customer_name: customerName,
      items,
      session_amount: sessionPrice,
      orders_amount: ordersAmount,
      total_amount: total,
      payment_method: opts.paymentMethod,
      created_by: "admin",
    })
    .select()
    .single();
  if (e2) throw e2;
  return invoice as Invoice;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data, error } = await sb().from("invoices").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Invoice;
}
