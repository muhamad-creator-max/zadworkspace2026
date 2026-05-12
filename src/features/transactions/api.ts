"use client";
import { createClient } from "@/lib/supabase/client";
import type { Invoice } from "@/lib/types";

const sb = () => createClient();

export type TxKind = "all" | "session" | "subscription" | "orders";

export async function listTransactions(opts: {
  from?: string;
  to?: string;
  paymentMethod?: string;
  kind?: TxKind;
  search?: string;
  sortBy?: "issued_at" | "total_amount" | "customer_name";
  sortDir?: "asc" | "desc";
}): Promise<Invoice[]> {
  let q = sb()
    .from("invoices")
    .select("*")
    .is("deleted_at", null);

  if (opts.from) q = q.gte("issued_at", opts.from);
  if (opts.to) q = q.lte("issued_at", opts.to);
  if (opts.paymentMethod && opts.paymentMethod !== "All")
    q = q.eq("payment_method", opts.paymentMethod);

  if (opts.kind === "session" || opts.kind === "subscription")
    q = q.eq("kind", opts.kind);
  // "orders" is filtered client-side (invoices that contain non-session items)

  if (opts.search?.trim()) q = q.ilike("customer_name", `%${opts.search.trim()}%`);

  const sortBy = opts.sortBy ?? "issued_at";
  const sortDir = opts.sortDir ?? "desc";
  q = q.order(sortBy, { ascending: sortDir === "asc" });

  const { data, error } = await q.limit(500);
  if (error) throw error;
  let rows = (data ?? []) as Invoice[];
  if (opts.kind === "orders")
    rows = rows.filter((r) => Number(r.orders_amount) > 0);
  return rows;
}
