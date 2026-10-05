"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import Link from "next/link";
import {
  Search, ArrowUpDown, ExternalLink, ChevronLeft, ChevronRight,
  BarChart2, List, TrendingUp, Users, RefreshCw, Activity,
  Wallet, Plus, Trash2, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { PasswordConfirmDialog } from "@/components/ui/PasswordConfirmDialog";
import { AdminDeleteButton } from "@/components/ui/AdminDeleteButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { usePersistedState, useMounted } from "@/hooks/usePersistedState";
import { listTransactions, softDeleteInvoice, type TxKind } from "@/features/transactions/api";
import {
  getRevenueEntries, getRetentionByMonth, getAvgVisitsByMonth,
  getActiveMembersByMonth, getAnalyticsSummary, getTopCustomers,
  type RevenueEntry, type RetentionPoint, type AvgVisitsPoint,
  type ActiveMembersPoint, type TopCustomer, type AnalyticsSummary,
} from "@/features/transactions/analytics";
import {
  listExpenses, listIncomes, createExpense, createIncome,
  softDeleteExpense, softDeleteIncome, getFinanceSummary, getFinanceEntries,
  type FinanceSummary, type FinanceEntry,
} from "@/features/finance/api";
import { FinanceFormModal, type FinanceKind } from "@/features/finance/FinanceFormModal";
import type { Invoice, Expense, Income } from "@/lib/types";
import { dt, money } from "@/lib/format";
import { startOfWeekSat } from "@/features/attendance/week";
import { TrendChart, type TrendSeries } from "@/components/charts/TrendChart";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketize } from "@/lib/timeBuckets";

const METHODS = ["All", "Cash", "Card", "Mobile Wallet", "Instapay"];
const KINDS: { value: TxKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "session", label: "Sessions" },
  { value: "orders", label: "Orders" },
  { value: "subscription", label: "Subscriptions" },
];
type SortBy = "issued_at" | "total_amount" | "customer_name";
type Tab = "transactions" | "analytics" | "finance";
const PAGE_SIZE = 100;

const REVENUE_SERIES = [
  { key: "sessions", label: "Sessions", color: "var(--chart-1)" },
  { key: "orders", label: "Orders", color: "var(--chart-2)" },
  { key: "subscriptions", label: "Subscriptions", color: "var(--chart-3)" },
] as const satisfies readonly TrendSeries<string>[];
const REVENUE_KEYS = REVENUE_SERIES.map((s) => s.key);

const FINANCE_SERIES = [
  { key: "income", label: "Income", color: "var(--chart-1)" },
  { key: "expenses", label: "Expenses", color: "var(--chart-4)" },
  { key: "net", label: "Net", color: "var(--chart-3)" },
] as const satisfies readonly TrendSeries<string>[];

// Helpers for <input type="datetime-local">. Local-time string ↔ ISO.
function toLocalDt(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Finance filters are datetime-local strings and may be cleared; the chart
// falls back to the last 30 days ending now.
function financeRange(from: string, to: string) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 86400000);
  if (to) end.setSeconds(59, 999);
  return { from: start, to: end };
}
function localToIso(local: string) {
  if (!local) return undefined;
  return new Date(local).toISOString();
}
function localDate(d: Date) { return toLocalDt(d).slice(0, 10); }
// YYYY-MM-DD → start / end of that day in local time.
function dayStart(date: string) { return new Date(`${date}T00:00:00`); }
function dayEnd(date: string) { return new Date(`${date}T23:59:59.999`); }

// Default filter range: the current day (local time).
function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return toLocalDt(d); }
function todayEnd() { const d = new Date(); d.setHours(23, 59, 0, 0); return toLocalDt(d); }

const FILTER_KEY = "zad.analytics.";

// Quick date-range presets. Every range ends at the end of today; "3 Months"
// is the current month plus the two before it (week starts Saturday).
type Preset = "day" | "week" | "month" | "3months" | "all";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "day", label: "This Day" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3months", label: "3 Months" },
  { value: "all", label: "All Time" },
];
function presetRange(p: Preset): { from: string; to: string } {
  if (p === "all") return { from: "", to: "" };
  const now = new Date();
  let start: Date;
  if (p === "week") start = startOfWeekSat(now);
  else if (p === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (p === "3months") start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  else start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: toLocalDt(start), to: todayEnd() };
}

export default function TransactionsPage() {
  const { push } = useToast();
  const isAdmin = useAdminGuard();
  const mounted = useMounted();
  const [tab, setTab] = usePersistedState<Tab>(FILTER_KEY + "tab", "transactions");

  // ── Transactions ───────────────────────────────────────────────────────────
  const [rows, setRows] = useState<Invoice[]>([]);
  const [invoiceDeleteTarget, setInvoiceDeleteTarget] = useState<Invoice | null>(null);
  const [search, setSearch] = usePersistedState(FILTER_KEY + "search", "");
  const [from, setFrom] = usePersistedState(FILTER_KEY + "from", todayStart);   // local datetime string
  const [to, setTo] = usePersistedState(FILTER_KEY + "to", todayEnd);           // local datetime string
  const [method, setMethod] = usePersistedState(FILTER_KEY + "method", "All");
  const [kind, setKind] = usePersistedState<TxKind>(FILTER_KEY + "kind", "all");
  const [sortBy, setSortBy] = usePersistedState<SortBy>(FILTER_KEY + "sortBy", "issued_at");
  const [sortDir, setSortDir] = usePersistedState<"asc" | "desc">(FILTER_KEY + "sortDir", "desc");
  const [page, setPage] = useState(1);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const [analyticsFrom, setAnalyticsFrom] = usePersistedState(FILTER_KEY + "analyticsFrom", () => localDate(new Date()));
  const [analyticsTo, setAnalyticsTo] = usePersistedState(FILTER_KEY + "analyticsTo", () => localDate(new Date()));
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [revenueEntries, setRevenueEntries] = useState<RevenueEntry[]>([]);
  const [retention, setRetention] = useState<RetentionPoint[]>([]);
  const [avgVisits, setAvgVisits] = useState<AvgVisitsPoint[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMembersPoint[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Finance (Expenses & Income) ─────────────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFrom, setFinanceFrom] = usePersistedState(FILTER_KEY + "financeFrom", todayStart);
  const [financeTo, setFinanceTo] = usePersistedState(FILTER_KEY + "financeTo", todayEnd);
  const [financeMethod, setFinanceMethod] = usePersistedState(FILTER_KEY + "financeMethod", "All");
  const [financeSearch, setFinanceSearch] = usePersistedState(FILTER_KEY + "financeSearch", "");
  const [formOpen, setFormOpen] = useState<null | FinanceKind>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    null | { kind: "expense"; row: Expense } | { kind: "income"; row: Income }
  >(null);

  const filtersActive = !!(search.trim() || from || to || method !== "All" || kind !== "all");

  const refresh = useCallback(async () => {
    try {
      const data = await listTransactions({
        from: localToIso(from),
        to: localToIso(to),
        paymentMethod: method,
        kind,
        search,
        sortBy,
        sortDir,
      });
      setRows(data);
      setPage(1);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  }, [from, to, method, kind, search, sortBy, sortDir, push]);

  useEffect(() => {
    if (!mounted || tab !== "transactions") return;
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
  }, [refresh, tab, mounted]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const fromIso = dayStart(analyticsFrom).toISOString();
      const toIso = dayEnd(analyticsTo).toISOString();
      const [sum, rev, ret, avg, active, top] = await Promise.all([
        getAnalyticsSummary(),
        getRevenueEntries(fromIso, toIso),
        getRetentionByMonth(fromIso, toIso),
        getAvgVisitsByMonth(fromIso, toIso),
        getActiveMembersByMonth(fromIso, toIso),
        getTopCustomers(10),
      ]);
      setSummary(sum);
      setRevenueEntries(rev);
      setRetention(ret);
      setAvgVisits(avg);
      setActiveMembers(active);
      setTopCustomers(top);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsFrom, analyticsTo, push]);

  useEffect(() => {
    if (!mounted || tab !== "analytics") return;
    loadAnalytics();
  }, [tab, loadAnalytics, mounted]);

  const loadFinance = useCallback(async () => {
    setFinanceLoading(true);
    try {
      const filters = {
        from: localToIso(financeFrom),
        to: localToIso(financeTo),
        paymentMethod: financeMethod,
        search: financeSearch,
      };
      const range = financeRange(financeFrom, financeTo);
      const [exp, inc, sum, series] = await Promise.all([
        listExpenses(filters),
        listIncomes(filters),
        getFinanceSummary(),
        getFinanceEntries(range.from.toISOString(), range.to.toISOString()),
      ]);
      setExpenses(exp);
      setIncomes(inc);
      setFinanceSummary(sum);
      setFinanceEntries(series);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setFinanceLoading(false);
    }
  }, [financeFrom, financeTo, financeMethod, financeSearch, push]);

  useEffect(() => {
    if (!mounted || tab !== "finance") return;
    const t = setTimeout(loadFinance, 200);
    return () => clearTimeout(t);
  }, [tab, loadFinance, mounted]);

  const displayedRows = useMemo(() => {
    if (filtersActive) return rows;
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page, filtersActive]);

  const totalPages = filtersActive ? 1 : Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const totals = useMemo(() => {
    const src = filtersActive ? rows : displayedRows;
    // Only count the part of each invoice that matches the selected kind,
    // e.g. "Sessions" shows 0 for Orders even if session invoices include orders.
    const sessions = kind === "all" || kind === "session"
      ? src.reduce((s, r) => s + Number(r.session_amount), 0) : 0;
    const orders = kind === "all" || kind === "orders"
      ? src.reduce((s, r) => s + Number(r.orders_amount), 0) : 0;
    const sum = kind === "session" ? sessions
      : kind === "orders" ? orders
      : src.reduce((s, r) => s + Number(r.total_amount), 0);
    return { sum, sessions, orders, count: rows.length };
  }, [rows, displayedRows, filtersActive, kind]);

  const revenueChart = useMemo(
    () => bucketize(dayStart(analyticsFrom), dayEnd(analyticsTo), REVENUE_KEYS,
      revenueEntries.map(({ at, ...values }) => ({ at, values }))),
    [revenueEntries, analyticsFrom, analyticsTo],
  );

  const financeChart = useMemo(() => {
    const range = financeRange(financeFrom, financeTo);
    const b = bucketize(range.from, range.to, ["income", "expenses"] as const,
      financeEntries.map(({ at, ...values }) => ({ at, values })));
    const income = financeEntries.reduce((sum, e) => sum + e.income, 0);
    const expenses = financeEntries.reduce((sum, e) => sum + e.expenses, 0);
    return {
      ...b,
      range,
      totals: { income, expenses, net: income - expenses },
      rows: b.rows.map((r) => ({ ...r, net: r.income - r.expenses })),
    };
  }, [financeEntries, financeFrom, financeTo]);

  const financeTotals = useMemo(() => {
    const expSum = expenses.reduce((s, r) => s + Number(r.amount), 0);
    const incSum = incomes.reduce((s, r) => s + Number(r.amount), 0);
    return { expSum, incSum, net: incSum - expSum };
  }, [expenses, incomes]);

  const toggleSort = (col: SortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const handleSubmitFinance = async (kind: FinanceKind, v: any) => {
    if (kind === "expense") {
      await createExpense(v);
      push({ kind: "ok", msg: "Expense saved" });
    } else {
      await createIncome(v);
      push({ kind: "ok", msg: "Income saved" });
    }
    await loadFinance();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "expense") {
        await softDeleteExpense(deleteTarget.row);
        push({ kind: "ok", msg: "Expense deleted" });
      } else {
        await softDeleteIncome(deleteTarget.row);
        push({ kind: "ok", msg: "Income deleted" });
      }
      setDeleteTarget(null);
      await loadFinance();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Delete failed" });
    }
  };

  return (
    <>
      <Topbar title="Reviewing & Analytics" />
      <div className="p-5 space-y-4">

        {/* TAB SWITCHER */}
        <div className="inline-flex rounded-xl border p-1" style={{ borderColor: "var(--border)" }}>
          <TabBtn label="Transactions" icon={<List className="h-3.5 w-3.5" />} active={tab === "transactions"} onClick={() => setTab("transactions")} />
          <TabBtn label="Analytics" icon={<BarChart2 className="h-3.5 w-3.5" />} active={tab === "analytics"} onClick={() => setTab("analytics")} />
          <TabBtn label="Expenses & Income" icon={<Wallet className="h-3.5 w-3.5" />} active={tab === "finance"} onClick={() => setTab("finance")} />
        </div>

        {/* ── TRANSACTIONS ──────────────────────────────────────────────────── */}
        {tab === "transactions" && (
          <>
            <div className="card p-4 space-y-4">
              <FilterFields>
                <Field label="Search" className="sm:col-span-2 xl:col-span-1">
                  <SearchInput placeholder="Search customer / subscriber name…" value={search} onChange={setSearch} />
                </Field>
                <Field label="From (date & time)">
                  <input type="datetime-local" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="To (date & time)">
                  <input type="datetime-local" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
                <Field label="Payment" className="sm:col-span-2 xl:col-span-1">
                  <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
              </FilterFields>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <Field label="Period">
                  <PresetBar from={from} to={to} onPick={(r) => { setFrom(r.from); setTo(r.to); }} />
                </Field>
                <Field label="Type">
                  <Segmented options={KINDS} value={kind} onChange={setKind} />
                </Field>
              </div>
              {filtersActive && (
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Filters active — <span className="font-semibold" style={{ color: "var(--brand)" }}>{rows.length} results</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Invoices" value={String(totals.count)} />
              <Stat label="Sessions" value={money(totals.sessions)} />
              <Stat label="Orders" value={money(totals.orders)} />
              <Stat label="Total" value={money(totals.sum)} accent />
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-zad">
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th><SortBtn label="Customer" active={sortBy === "customer_name"} dir={sortDir} onClick={() => toggleSort("customer_name")} /></th>
                      <th>Items</th>
                      <th className="text-right"><SortBtn label="Total" active={sortBy === "total_amount"} dir={sortDir} onClick={() => toggleSort("total_amount")} /></th>
                      <th>Payment</th>
                      <th>Staff</th>
                      <th><SortBtn label="Date" active={sortBy === "issued_at"} dir={sortDir} onClick={() => toggleSort("issued_at")} /></th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono text-xs">#{r.id.slice(0, 8).toUpperCase()}</td>
                        <td>
                          <div className="font-medium">{r.customer_name ?? "—"}</div>
                          <span className="badge" style={{
                            background: r.kind === "subscription" ? "var(--brand)" : "var(--border)",
                            color: r.kind === "subscription" ? "#fff" : "var(--text)",
                          }}>{r.kind}</span>
                        </td>
                        <td className="max-w-xs">
                          <div className="truncate text-xs" style={{ color: "var(--muted)" }}>
                            {r.items.map((i) => `${i.qty}× ${i.name}`).join(" • ")}
                          </div>
                        </td>
                        <td className="text-right font-medium">{money(Number(r.total_amount))}</td>
                        <td>{r.payment_method}</td>
                        <td>{r.created_by}</td>
                        <td className="text-xs">{dt(r.issued_at)}</td>
                        <td>
                          <Link href={`/invoice/${r.id}`} className="btn btn-ghost !px-2 !py-1">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                        <td>
                          <AdminDeleteButton
                            isAdmin={isAdmin}
                            onClick={() => setInvoiceDeleteTarget(r)}
                          />
                        </td>
                      </tr>
                    ))}
                    {!displayedRows.length && (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>
                          No transactions match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!filtersActive && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    Page {page} of {totalPages} · {rows.length} total
                  </span>
                  <div className="flex items-center gap-1">
                    <button className="btn btn-ghost !px-2 !py-1" disabled={page === 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 7) p = i + 1;
                      else if (page <= 4) p = i + 1;
                      else if (page >= totalPages - 3) p = totalPages - 6 + i;
                      else p = page - 3 + i;
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          className="rounded-lg px-2.5 py-1 text-xs transition min-w-[28px]"
                          style={p === page ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text)" }}>
                          {p}
                        </button>
                      );
                    })}
                    <button className="btn btn-ghost !px-2 !py-1" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ANALYTICS ─────────────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <>
            <div className="card p-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="From">
                  <input type="date" className="input" value={analyticsFrom}
                    onChange={(e) => setAnalyticsFrom(e.target.value)} />
                </Field>
                <Field label="To">
                  <input type="date" className="input" value={analyticsTo}
                    onChange={(e) => setAnalyticsTo(e.target.value)} />
                </Field>
                <button className="btn btn-primary" onClick={loadAnalytics}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <Field label="Period">
                  <PresetBar dateOnly from={analyticsFrom} to={analyticsTo}
                    presets={PRESETS.filter((p) => p.value !== "all")}
                    onPick={(r) => { setAnalyticsFrom(r.from.slice(0, 10)); setAnalyticsTo(r.to.slice(0, 10)); }} />
                </Field>
              </div>
            </div>

            {analyticsLoading && !summary && (
              <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>
                Loading analytics…
              </div>
            )}

            {summary && (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <KpiCard label="Customers" value={String(summary.totalCustomers)} icon={<Users className="h-4 w-4" />} />
                  <KpiCard label="Subscribers" value={String(summary.totalSubscribers)} icon={<Users className="h-4 w-4" />} />
                  <KpiCard label="Active Now" value={String(summary.activeSubscribersNow)} icon={<Activity className="h-4 w-4" />} accent />
                  <KpiCard label="Avg Visits" value={`${summary.avgVisitsPerCustomer}×`} icon={<TrendingUp className="h-4 w-4" />} />
                  <KpiCard label="Retention (30d)" value={`${summary.retentionRate}%`} icon={<RefreshCw className="h-4 w-4" />} accent />
                  <KpiCard label="Total Sessions" value={String(summary.totalSessions)} icon={<BarChart2 className="h-4 w-4" />} />
                </div>

                <TrendChart
                  title="Revenue"
                  description={`Sessions, orders and subscriptions · ${rangeLabel(dayStart(analyticsFrom), dayEnd(analyticsTo))}`}
                  series={REVENUE_SERIES}
                  rows={revenueChart.rows}
                  granularity={revenueChart.granularity}
                  formatValue={money}
                  storageKey={FILTER_KEY + "revenueSeries"}
                  showTotal
                  loading={analyticsLoading}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {retention.length > 0 && (
                    <MetricCard
                      title="Retention Rate"
                      description="% of visitors who came back"
                      badge={`${retention.at(-1)?.retentionRate ?? 0}% latest`}
                    >
                      <MiniLineChart
                        data={retention.map((r) => ({ label: monthLabel(r.month), value: r.retentionRate }))}
                        label="Retention"
                        color="var(--chart-1)"
                        yMax={100}
                        format={(v) => `${v}%`}
                      />
                      <MonthRows rows={retention.map((r) => ({
                        month: r.month,
                        cells: [["New", r.new], ["Return", r.returning]],
                        value: `${r.retentionRate}%`,
                      }))} />
                    </MetricCard>
                  )}

                  {avgVisits.length > 0 && (
                    <MetricCard
                      title="Avg Visits / Customer"
                      description="Sessions ÷ unique visitors"
                      badge={`${avgVisits.at(-1)?.avgVisits ?? 0}× latest`}
                    >
                      <MiniLineChart
                        data={avgVisits.map((r) => ({ label: monthLabel(r.month), value: r.avgVisits }))}
                        label="Avg visits"
                        color="var(--chart-2)"
                        format={(v) => `${v}×`}
                      />
                      <MonthRows rows={avgVisits.map((r) => ({
                        month: r.month,
                        cells: [["Unique", r.uniqueCustomers], ["Sessions", r.totalVisits]],
                        value: `${r.avgVisits}×`,
                      }))} />
                    </MetricCard>
                  )}

                  {activeMembers.length > 0 && (
                    <MetricCard
                      title="Active Members"
                      description="Subscribers with a session that month"
                      badge={`${activeMembers.at(-1)?.activeRate ?? 0}% latest`}
                    >
                      <ActiveMembersChart data={activeMembers} />
                      <MonthRows rows={activeMembers.map((r) => ({
                        month: r.month,
                        cells: [["Total", r.totalSubscribers], ["Active", r.activeSubscribers]],
                        value: `${r.activeRate}%`,
                      }))} />
                    </MetricCard>
                  )}

                  {topCustomers.length > 0 && (
                    <MetricCard title="Top Customers" description="By number of invoices, all time">
                      <div className="space-y-3">
                        {topCustomers.map((c, i) => {
                          const pct = Math.round((c.visits / topCustomers[0].visits) * 100);
                          return (
                            <div key={c.name}>
                              <div className="mb-1 flex items-center justify-between">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                                  <span className="truncate text-sm font-medium">{c.name}</span>
                                </div>
                                <div className="ml-2 flex shrink-0 items-center gap-3">
                                  <span className="text-xs text-muted-foreground">{c.visits}×</span>
                                  <span className="text-xs font-medium tabular-nums">{money(c.totalSpend)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--chart-1)", transition: "width 0.4s ease" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </MetricCard>
                  )}
                </div>

                {!retention.length && !avgVisits.length && !activeMembers.length && (
                  <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>
                    No session data in the selected date range.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── FINANCE (Expenses & Income) ───────────────────────────────────── */}
        {tab === "finance" && (
          <>
            {/* Action bar */}
            <div className="card p-4 space-y-4">
              <FilterFields>
                <Field label="Search" className="sm:col-span-2 xl:col-span-1">
                  <SearchInput placeholder="Search expense / income name…" value={financeSearch} onChange={setFinanceSearch} />
                </Field>
                <Field label="From (date & time)">
                  <input type="datetime-local" className="input" value={financeFrom}
                    onChange={(e) => setFinanceFrom(e.target.value)} />
                </Field>
                <Field label="To (date & time)">
                  <input type="datetime-local" className="input" value={financeTo}
                    onChange={(e) => setFinanceTo(e.target.value)} />
                </Field>
                <Field label="Payment" className="sm:col-span-2 xl:col-span-1">
                  <select className="input" value={financeMethod} onChange={(e) => setFinanceMethod(e.target.value)}>
                    {METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
              </FilterFields>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <Field label="Period">
                  <PresetBar from={financeFrom} to={financeTo}
                    onPick={(r) => { setFinanceFrom(r.from); setFinanceTo(r.to); }} />
                </Field>
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="btn btn-primary" onClick={() => setFormOpen("expense")}>
                    <Plus className="h-3.5 w-3.5" /> Add Expense
                  </button>
                  <button className="btn btn-primary" onClick={() => setFormOpen("income")}>
                    <Plus className="h-3.5 w-3.5" /> Add Income
                  </button>
                  <button className="btn btn-ghost" onClick={loadFinance}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </button>
                  <Link href="/delete-log" className="btn btn-ghost">
                    <Trash2 className="h-3.5 w-3.5" /> Delete Log
                  </Link>
                </div>
              </div>
            </div>

            {/* Summary */}
            {financeSummary && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SummaryCard
                  label={`Month Income (${financeSummary.monthLabel})`}
                  value={money(financeSummary.monthIncome)}
                  sublabel={`Expenses ${money(financeSummary.monthExpenses)}`}
                  icon={<ArrowDownCircle className="h-4 w-4" />}
                  accentColor="var(--chart-1)"
                />
                <SummaryCard
                  label="Month Net"
                  value={money(financeSummary.monthNet)}
                  sublabel={financeSummary.monthNet >= 0 ? "Surplus this month" : "Deficit this month"}
                  icon={<TrendingUp className="h-4 w-4" />}
                  accentColor={financeSummary.monthNet >= 0 ? "var(--brand)" : "#c2410c"}
                />
                <SummaryCard
                  label={`Net Profit (${rangeLabel(financeChart.range.from, financeChart.range.to)})`}
                  value={money(financeChart.totals.net)}
                  sublabel={`Income ${money(financeChart.totals.income)} · Expenses ${money(financeChart.totals.expenses)}`}
                  icon={<Wallet className="h-4 w-4" />}
                  accentColor={financeChart.totals.net >= 0 ? "var(--brand)" : "#c2410c"}
                />
              </div>
            )}

            {/* Income vs Expenses over the filtered period */}
            {financeSummary && (
              <TrendChart
                title="Income vs Expenses"
                description={`Sales + other income against expenses · ${rangeLabel(financeChart.range.from, financeChart.range.to)}`}
                series={FINANCE_SERIES}
                rows={financeChart.rows}
                granularity={financeChart.granularity}
                formatValue={money}
                storageKey={FILTER_KEY + "financeSeries"}
                loading={financeLoading}
              />
            )}

            {financeLoading && (
              <div className="card p-6 text-center text-sm" style={{ color: "var(--muted)" }}>
                Loading…
              </div>
            )}

            {/* Two columns: Income list / Expense list */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FinanceListCard
                title="Income"
                icon={<ArrowDownCircle className="h-4 w-4" />}
                rows={incomes}
                totalLabel="Total Income (filtered)"
                totalValue={money(financeTotals.incSum)}
                onDelete={(row) => setDeleteTarget({ kind: "income", row })}
              />
              <FinanceListCard
                title="Expenses"
                icon={<ArrowUpCircle className="h-4 w-4" />}
                rows={expenses}
                totalLabel="Total Expenses (filtered)"
                totalValue={money(financeTotals.expSum)}
                onDelete={(row) => setDeleteTarget({ kind: "expense", row })}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <FinanceFormModal
        open={formOpen !== null}
        kind={formOpen ?? "expense"}
        onClose={() => setFormOpen(null)}
        onSubmit={(v) => handleSubmitFinance(formOpen!, v)}
      />

      {/* Invoice delete */}
      <PasswordConfirmDialog
        open={invoiceDeleteTarget !== null}
        title="Delete transaction?"
        message={
          invoiceDeleteTarget
            ? `This will soft-delete invoice #${invoiceDeleteTarget.id.slice(0, 8).toUpperCase()} for "${invoiceDeleteTarget.customer_name ?? "—"}" (${money(Number(invoiceDeleteTarget.total_amount))}). Historical data is preserved.`
            : ""
        }
        confirmLabel="Confirm delete"
        onCancel={() => setInvoiceDeleteTarget(null)}
        onConfirmed={async () => {
          await softDeleteInvoice(invoiceDeleteTarget!.id);
          push({ kind: "ok", msg: "Transaction deleted" });
          setInvoiceDeleteTarget(null);
          refresh();
        }}
      />

      {/* Expense / Income delete */}
      <PasswordConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === "expense"
            ? "Delete expense?"
            : "Delete income?"
        }
        message={
          deleteTarget
            ? `This will remove "${deleteTarget.row.name}" (${money(Number(deleteTarget.row.amount))}). It will be logged in Delete Log.`
            : ""
        }
        confirmLabel="Confirm delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirmed={handleConfirmDelete}
      />
    </>
  );
}

// ─── Shared tiny helpers ──────────────────────────────────────────────────────

// Filter row: every field has a label on top, so inputs line up on one baseline.
function FilterFields({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_210px_210px_160px]">
      {children}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--muted)" }} />
      <input className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border)" }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition"
            style={active ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Highlights the preset matching the current range; picking one sets from/to.
// `dateOnly` compares YYYY-MM-DD values (for <input type="date">).
function PresetBar({ from, to, onPick, dateOnly, presets = PRESETS }: {
  from: string; to: string; onPick: (r: { from: string; to: string }) => void;
  dateOnly?: boolean; presets?: { value: Preset; label: string }[];
}) {
  const norm = (v: string) => (dateOnly ? v.slice(0, 10) : v);
  const active = presets.find((p) => {
    const r = presetRange(p.value);
    return norm(r.from) === from && norm(r.to) === to;
  })?.value ?? null;
  return <Segmented options={presets} value={active} onChange={(p) => onPick(presetRange(p))} />;
}

function TabBtn({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition"
      style={active ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text)" }}>
      {icon} {label}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-lg font-semibold" style={accent ? { color: "var(--brand)" } : undefined}>{value}</div>
    </div>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex-row items-center gap-2 px-4">
        <CardDescription className="font-medium">{label}</CardDescription>
        <CardAction>
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted"
            style={{ color: accent ? "var(--chart-1)" : "var(--muted)" }}>
            {icon}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function SortBtn({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1">
      {label} <ArrowUpDown className="h-3 w-3" style={{ opacity: active ? 1 : 0.4 }} />
      {active && <span className="text-[10px]">{dir}</span>}
    </button>
  );
}

function SummaryCard({
  label, value, sublabel, icon, accentColor,
}: {
  label: string; value: string; sublabel?: string; icon: React.ReactNode; accentColor?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="label">{label}</span>
        <span style={{ color: accentColor ?? "var(--muted)" }}>{icon}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: accentColor ?? "var(--text)" }}>{value}</div>
      {sublabel && (
        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{sublabel}</div>
      )}
    </div>
  );
}

function FinanceListCard({
  title, icon, rows, totalLabel, totalValue, onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  rows: (Expense | Income)[];
  totalLabel: string;
  totalValue: string;
  onDelete: (row: any) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--brand)" }}>{icon}</span>
          <p className="font-semibold text-sm">{title}</p>
          <span className="badge" style={{ background: "var(--border)", color: "var(--text)" }}>
            {rows.length}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{totalLabel}</div>
          <div className="text-sm font-semibold" style={{ color: "var(--brand)" }}>{totalValue}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table-zad">
          <thead>
            <tr>
              <th>Name</th>
              <th>Reason</th>
              <th className="text-right">Amount</th>
              <th>Payment</th>
              <th>Due</th>
              <th>By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td className="max-w-xs">
                  <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{r.reason || "—"}</div>
                </td>
                <td className="text-right font-medium">{money(Number(r.amount))}</td>
                <td>{r.payment_method}</td>
                <td className="text-xs">{dt(r.payment_due)}</td>
                <td className="text-xs">{r.created_by}</td>
                <td>
                  <button
                    className="btn btn-ghost !px-2 !py-1"
                    title="Delete"
                    onClick={() => onDelete(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analytics cards & charts ─────────────────────────────────────────────────

// "2026-10" → "Oct 26"
function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function rangeLabel(from: Date, to: Date) {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return fmt(from) === fmt(to) ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function MetricCard({ title, description, badge, children }: {
  title: string; description: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {badge && (
          <CardAction>
            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium">
              {badge}
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MonthRows({ rows }: { rows: { month: string; cells: [string, number][]; value: string }[] }) {
  return (
    <div className="mt-4 divide-y divide-border border-t border-border">
      {rows.map((r) => (
        <div key={r.month} className="flex items-center justify-between py-2 text-xs">
          <span className="text-muted-foreground">{monthLabel(r.month)}</span>
          <div className="flex gap-4">
            {r.cells.map(([k, v]) => (
              <span key={k} className="text-muted-foreground">
                {k} <b className="font-semibold tabular-nums text-foreground">{v}</b>
              </span>
            ))}
            <span className="w-12 text-right font-semibold tabular-nums">{r.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniLineChart({ data, label, color, yMax, format }: {
  data: { label: string; value: number }[];
  label: string;
  color: string;
  yMax?: number;
  format: (v: number) => string;
}) {
  const config = { value: { label, color } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[160px] w-full">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={40} domain={[0, yMax ?? "auto"]}
          tickFormatter={(v: number) => format(v)} />
        <ChartTooltip
          cursor={{ strokeDasharray: "4 4" }}
          content={(props) => (
            <ChartTooltipContent active={props.active} payload={props.payload as never}
              label={props.label} valueFormatter={(v) => format(v)} />
          )}
        />
        <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--color-value)", stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

function ActiveMembersChart({ data }: { data: ActiveMembersPoint[] }) {
  const config = {
    active: { label: "Active", color: "var(--chart-1)" },
    inactive: { label: "Inactive", color: "var(--border)" },
  } satisfies ChartConfig;
  const rows = data.map((d) => ({
    label: monthLabel(d.month),
    active: d.activeSubscribers,
    inactive: Math.max(0, d.totalSubscribers - d.activeSubscribers),
  }));
  return (
    <ChartContainer config={config} className="aspect-auto h-[160px] w-full"
      style={{ "--hover-fill": "color-mix(in srgb, var(--text) 5%, transparent)" } as React.CSSProperties}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip
          content={(props) => (
            <ChartTooltipContent active={props.active} payload={props.payload as never} label={props.label} />
          )}
        />
        <Bar dataKey="active" stackId="m" fill="var(--color-active)" maxBarSize={36} isAnimationActive={false} />
        <Bar dataKey="inactive" stackId="m" fill="var(--color-inactive)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
