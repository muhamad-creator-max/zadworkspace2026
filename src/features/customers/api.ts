"use client";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Subscriber } from "@/lib/types";
import { currentActor, logDeletion } from "@/lib/deleteLog";

const sb = () => createClient();

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await sb()
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await sb()
    .from("subscribers")
    .select("*, plan:plans(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function searchPeople(q: string) {
  const term = `%${q}%`;
  const supabase = sb();
  const [{ data: customers }, { data: subscribers }] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .or(`name.ilike.${term},phone.ilike.${term}`)
      .limit(10),
    supabase
      .from("subscribers")
      .select("*, plan:plans(*)")
      .is("deleted_at", null)
      .or(`name.ilike.${term},phone.ilike.${term},code.ilike.${term}`)
      .limit(10),
  ]);
  return {
    customers: (customers ?? []) as Customer[],
    subscribers: (subscribers ?? []) as Subscriber[],
  };
}

export async function createCustomer(input: { name: string; phone: string; study?: string }) {
  const { data, error } = await sb()
    .from("customers")
    .insert({ name: input.name, phone: input.phone, study: input.study ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string, patch: Partial<Customer>) {
  const { data, error } = await sb()
    .from("customers")
    .update({ name: patch.name, phone: patch.phone, study: patch.study })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function softDeleteCustomer(id: string) {
  const { data: customer } = await sb().from("customers").select("*").eq("id", id).single();
  const deleted_by = await currentActor();
  const { error } = await sb()
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logDeletion({
    entity_type: "customer",
    entity_id: id,
    entity_label: customer?.name ?? null,
    snapshot: customer,
    deleted_by,
  });
}

export async function findActiveSessionForPerson(opts: {
  customer_id?: string;
  subscriber_id?: string;
}) {
  let query = sb()
    .from("sessions")
    .select("*, room:rooms(*), customer:customers(*), subscriber:subscribers(*, plan:plans(*))")
    .is("deleted_at", null)
    .eq("status", "active")
    .limit(1);
  if (opts.customer_id) query = query.eq("customer_id", opts.customer_id);
  if (opts.subscriber_id) query = query.eq("subscriber_id", opts.subscriber_id);
  const { data, error } = await query.maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}
