"use client";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, Session, SessionOrder } from "@/lib/types";
import { priceForDuration } from "@/lib/pricing";
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
 * Close a session and create an invoice.
 * For subscribers, session_price = 0 (they've prepaid) and hours_remaining decrements.
 */
export async function checkoutSession(opts: {
  sessionId: string;
  paymentMethod: string;
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
  const minutes = minutesBetween(session.started_at, endedAt);
  const isSubscriber = !!session.subscriber_id;
  const sessionPrice = isSubscriber ? 0 : priceForDuration(session.room!, minutes);

  const orders = await getOrdersForSession(session.id);
  const ordersAmount = orders.reduce((s, o) => s + Number(o.line_total), 0);
  const total = sessionPrice + ordersAmount;

  // Build invoice items snapshot
  const items: Invoice["items"] = [];
  if (sessionPrice > 0 || !isSubscriber) {
    const hoursLabel = Math.max(1, Math.ceil(minutes / 60));
    items.push({
      name: `${session.room?.name ?? "Room"} session (${hoursLabel}h)`,
      qty: 1,
      price: sessionPrice,
      total: sessionPrice,
    });
  } else {
    items.push({
      name: `${session.room?.name ?? "Room"} session (subscriber)`,
      qty: 1,
      price: 0,
      total: 0,
    });
  }
  for (const o of orders) {
    items.push({
      name: o.item_name,
      qty: o.quantity,
      price: Number(o.unit_price),
      total: Number(o.line_total),
    });
  }

  // Close session
  const { error: e1 } = await supabase
    .from("sessions")
    .update({
      status: "closed",
      ended_at: endedAt,
      duration_minutes: minutes,
      session_price: sessionPrice,
    })
    .eq("id", session.id);
  if (e1) throw e1;

  // Decrement subscriber hours
  if (isSubscriber && session.subscriber) {
    const used = minutes / 60;
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
