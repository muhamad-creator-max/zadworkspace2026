"use client";
import { createClient } from "@/lib/supabase/client";
import type { Expense, Income, DeleteLogEntry } from "@/lib/types";
import { currentActor, logDeletion } from "@/lib/deleteLog";

const sb = () => createClient();

/**
 * Re-authenticate the current user with their password before allowing a
 * destructive action. Returns true on success, false on bad password.
 */
export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const supabase = sb();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  return !error;
}

// ── EXPENSES ─────────────────────────────────────────────────────────────────

export interface FinanceFilters {
  from?: string; // ISO datetime
  to?: string;   // ISO datetime
  search?: string;
  paymentMethod?: string;
}

export async function listExpenses(opts: FinanceFilters = {}): Promise<Expense[]> {
  let q = sb()
    .from("expenses")
    .select("*")
    .is("deleted_at", null);
  if (opts.from) q = q.gte("payment_due", opts.from);
  if (opts.to) q = q.lte("payment_due", opts.to);
  if (opts.paymentMethod && opts.paymentMethod !== "All")
    q = q.eq("payment_method", opts.paymentMethod);
  if (opts.search?.trim()) q = q.ilike("name", `%${opts.search.trim()}%`);
  q = q.order("payment_due", { ascending: false }).limit(500);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function createExpense(input: {
  name: string;
  reason?: string;
  amount: number;
  payment_method: string;
  payment_due: string; // ISO
}): Promise<Expense> {
  const created_by = await currentActor();
  const { data, error } = await sb()
    .from("expenses")
    .insert({
      name: input.name,
      reason: input.reason ?? null,
      amount: input.amount,
      payment_method: input.payment_method,
      payment_due: input.payment_due,
      created_by,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function softDeleteExpense(expense: Expense): Promise<void> {
  const deleted_by = await currentActor();
  const now = new Date().toISOString();
  const { error } = await sb()
    .from("expenses")
    .update({ deleted_at: now })
    .eq("id", expense.id);
  if (error) throw error;
  await logDeletion({
    entity_type: "expense",
    entity_id: expense.id,
    entity_label: expense.name,
    entity_amount: Number(expense.amount),
    snapshot: expense,
    deleted_by,
  });
}

// ── INCOMES ──────────────────────────────────────────────────────────────────

export async function listIncomes(opts: FinanceFilters = {}): Promise<Income[]> {
  let q = sb()
    .from("incomes")
    .select("*")
    .is("deleted_at", null);
  if (opts.from) q = q.gte("payment_due", opts.from);
  if (opts.to) q = q.lte("payment_due", opts.to);
  if (opts.paymentMethod && opts.paymentMethod !== "All")
    q = q.eq("payment_method", opts.paymentMethod);
  if (opts.search?.trim()) q = q.ilike("name", `%${opts.search.trim()}%`);
  q = q.order("payment_due", { ascending: false }).limit(500);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Income[];
}

export async function createIncome(input: {
  name: string;
  reason?: string;
  amount: number;
  payment_method: string;
  payment_due: string;
}): Promise<Income> {
  const created_by = await currentActor();
  const { data, error } = await sb()
    .from("incomes")
    .insert({
      name: input.name,
      reason: input.reason ?? null,
      amount: input.amount,
      payment_method: input.payment_method,
      payment_due: input.payment_due,
      created_by,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Income;
}

export async function softDeleteIncome(income: Income): Promise<void> {
  const deleted_by = await currentActor();
  const now = new Date().toISOString();
  const { error } = await sb()
    .from("incomes")
    .update({ deleted_at: now })
    .eq("id", income.id);
  if (error) throw error;
  await logDeletion({
    entity_type: "income",
    entity_id: income.id,
    entity_label: income.name,
    entity_amount: Number(income.amount),
    snapshot: income,
    deleted_by,
  });
}

// ── DELETE LOG ───────────────────────────────────────────────────────────────

export async function listDeleteLog(opts: {
  from?: string;
  to?: string;
} = {}): Promise<DeleteLogEntry[]> {
  let q = sb().from("delete_log").select("*");
  if (opts.from) q = q.gte("deleted_at", opts.from);
  if (opts.to) q = q.lte("deleted_at", opts.to);
  q = q.order("deleted_at", { ascending: false }).limit(1000);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DeleteLogEntry[];
}

// ── FINANCIAL SUMMARY ─────────────────────────────────────────────────────────

export interface FinanceSummary {
  monthLabel: string;             // e.g. "2026-05"
  monthIncome: number;            // from incomes + invoices (this month)
  monthExpenses: number;          // from expenses (this month)
  monthNet: number;
  totalSystemIncome: number;      // invoices + incomes all-time (until now)
  totalSystemExpenses: number;    // expenses all-time (until now)
  netProfit: number;              // total income - total expenses
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nowIso = now.toISOString();

  const [invMonth, incMonth, expMonth, invAll, incAll, expAll] = await Promise.all([
    sb()
      .from("invoices")
      .select("total_amount")
      .is("deleted_at", null)
      .gte("issued_at", monthStart)
      .lte("issued_at", nowIso),
    sb()
      .from("incomes")
      .select("amount")
      .is("deleted_at", null)
      .gte("payment_due", monthStart)
      .lte("payment_due", nowIso),
    sb()
      .from("expenses")
      .select("amount")
      .is("deleted_at", null)
      .gte("payment_due", monthStart)
      .lte("payment_due", nowIso),
    sb()
      .from("invoices")
      .select("total_amount")
      .is("deleted_at", null)
      .lte("issued_at", nowIso),
    sb()
      .from("incomes")
      .select("amount")
      .is("deleted_at", null)
      .lte("payment_due", nowIso),
    sb()
      .from("expenses")
      .select("amount")
      .is("deleted_at", null)
      .lte("payment_due", nowIso),
  ]);

  const sum = (rows: any[] | null | undefined, key: string) =>
    (rows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0);

  const monthIncome = sum(invMonth.data, "total_amount") + sum(incMonth.data, "amount");
  const monthExpenses = sum(expMonth.data, "amount");
  const totalSystemIncome = sum(invAll.data, "total_amount") + sum(incAll.data, "amount");
  const totalSystemExpenses = sum(expAll.data, "amount");

  return {
    monthLabel,
    monthIncome,
    monthExpenses,
    monthNet: monthIncome - monthExpenses,
    totalSystemIncome,
    totalSystemExpenses,
    netProfit: totalSystemIncome - totalSystemExpenses,
  };
}
