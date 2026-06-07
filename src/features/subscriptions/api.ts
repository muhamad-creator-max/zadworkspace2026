"use client";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, Plan, Subscriber } from "@/lib/types";
import { currentActor, logDeletion } from "@/lib/deleteLog";

const sb = () => createClient();

// ----- Plans -----
export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await sb()
    .from("plans")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export type PlanInput = Omit<
  Plan,
  "id" | "created_at" | "updated_at" | "deleted_at"
>;

export async function createPlan(input: PlanInput) {
  const { data, error } = await sb().from("plans").insert(input).select().single();
  if (error) throw error;
  return data as Plan;
}

export async function updatePlan(id: string, input: PlanInput) {
  const { data, error } = await sb()
    .from("plans")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Plan;
}

export async function softDeletePlan(id: string) {
  const { data: plan } = await sb().from("plans").select("*").eq("id", id).single();
  const deleted_by = await currentActor();
  const { error } = await sb()
    .from("plans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logDeletion({
    entity_type: "plan",
    entity_id: id,
    entity_label: plan?.name ?? null,
    entity_amount: plan?.price != null ? Number(plan.price) : null,
    snapshot: plan,
    deleted_by,
  });
}

// ----- Subscribers -----
export async function listSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await sb()
    .from("subscribers")
    .select("*, plan:plans(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Subscriber[];
}

async function nextCodeForLetter(letter: string): Promise<string> {
  const upper = letter.toUpperCase();
  const { data } = await sb()
    .from("subscribers")
    .select("code")
    .ilike("code", `${upper}%`)
    .order("code", { ascending: false })
    .limit(1);
  let n = 1;
  if (data && data.length) {
    const last = data[0].code;
    const numPart = parseInt(last.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numPart)) n = numPart + 1;
  }
  return `${upper}${String(n).padStart(3, "0")}`;
}

export type CreateSubscriberInput = {
  name: string;
  phone: string;
  plan: Plan;
  payment_method: string;
};

export async function createSubscriber(
  input: CreateSubscriberInput
): Promise<{ subscriber: Subscriber; invoice: Invoice }> {
  const code = await nextCodeForLetter(input.plan.letter);
  const startsAt = new Date();
  const expiresAt = new Date(
    startsAt.getTime() + input.plan.expiration_days * 86400000
  );

  const { data: sub, error } = await sb()
    .from("subscribers")
    .insert({
      code,
      name: input.name,
      phone: input.phone,
      plan_id: input.plan.id,
      payment_method: input.payment_method,
      total_price: input.plan.price,
      total_hours: input.plan.hours,
      hours_remaining: input.plan.hours,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("*, plan:plans(*)")
    .single();
  if (error) throw error;

  // Create subscription invoice
  const { data: invoice, error: e2 } = await sb()
    .from("invoices")
    .insert({
      kind: "subscription",
      subscriber_id: sub.id,
      customer_name: `${input.name} (${code})`,
      items: [
        {
          name: `${input.plan.name} subscription (${input.plan.hours}h, ${input.plan.expiration_days}d)`,
          qty: 1,
          price: Number(input.plan.price),
          total: Number(input.plan.price),
        },
      ],
      session_amount: 0,
      orders_amount: 0,
      total_amount: Number(input.plan.price),
      payment_method: input.payment_method,
      created_by: "admin",
    })
    .select()
    .single();
  if (e2) throw e2;

  return { subscriber: sub as Subscriber, invoice: invoice as Invoice };
}

export async function updateSubscriber(
  id: string,
  patch: Partial<Pick<Subscriber, "name" | "phone" | "payment_method">>
) {
  const { data, error } = await sb()
    .from("subscribers")
    .update(patch)
    .eq("id", id)
    .select("*, plan:plans(*)")
    .single();
  if (error) throw error;
  return data as Subscriber;
}

export async function listSubscriberInvoices(subscriberId: string): Promise<Invoice[]> {
  const { data, error } = await sb()
    .from("invoices")
    .select("*")
    .eq("subscriber_id", subscriberId)
    .is("deleted_at", null)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invoice[];
}

export type RenewInput =
  | { mode: "same"; subscriberId: string; payment_method: string }
  | { mode: "switch"; subscriberId: string; plan: Plan; payment_method: string };

export async function renewSubscriber(
  input: RenewInput
): Promise<{ subscriber: Subscriber; invoice: Invoice }> {
  const { data: existing, error: fetchErr } = await sb()
    .from("subscribers")
    .select("*, plan:plans(*)")
    .eq("id", input.subscriberId)
    .single();
  if (fetchErr) throw fetchErr;

  const plan: Plan = input.mode === "switch" ? input.plan : (existing.plan as Plan);
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + plan.expiration_days * 86400000);

  const patch: Record<string, unknown> = {
    plan_id: plan.id,
    payment_method: input.payment_method,
    total_price: plan.price,
    total_hours: plan.hours,
    hours_remaining: plan.hours,
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  const { data: sub, error: updateErr } = await sb()
    .from("subscribers")
    .update(patch)
    .eq("id", input.subscriberId)
    .select("*, plan:plans(*)")
    .single();
  if (updateErr) throw updateErr;

  const { data: invoice, error: invErr } = await sb()
    .from("invoices")
    .insert({
      kind: "subscription",
      subscriber_id: sub.id,
      customer_name: `${sub.name} (${sub.code})`,
      items: [
        {
          name: `${plan.name} renewal (${plan.hours}h, ${plan.expiration_days}d)`,
          qty: 1,
          price: Number(plan.price),
          total: Number(plan.price),
        },
      ],
      session_amount: 0,
      orders_amount: 0,
      total_amount: Number(plan.price),
      payment_method: input.payment_method,
      created_by: "admin",
    })
    .select()
    .single();
  if (invErr) throw invErr;

  return { subscriber: sub as Subscriber, invoice: invoice as Invoice };
}

export async function softDeleteSubscriber(id: string) {
  const { data: sub } = await sb().from("subscribers").select("*").eq("id", id).single();
  const deleted_by = await currentActor();
  const { error } = await sb()
    .from("subscribers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logDeletion({
    entity_type: "subscriber",
    entity_id: id,
    entity_label: sub ? `${sub.name} (${sub.code})` : null,
    snapshot: sub,
    deleted_by,
  });
}
