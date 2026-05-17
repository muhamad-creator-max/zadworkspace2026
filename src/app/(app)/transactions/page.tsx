"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { listTransactions, softDeleteInvoice, type TxKind } from "@/features/transactions/api";
import {
  getDailyRevenue, getRetentionByMonth, getAvgVisitsByMonth,
  getActiveMembersByMonth, getAnalyticsSummary, getTopCustomers,
  type DailyRevenue, type RetentionPoint, type AvgVisitsPoint,
  type ActiveMembersPoint, type TopCustomer, type AnalyticsSummary,
} from "@/features/transactions/analytics";
import {
  listExpenses, listIncomes, createExpense, createIncome,
  softDeleteExpense, softDeleteIncome, getFinanceSummary,
  type FinanceSummary,
} from "@/features/finance/api";
import { FinanceFormModal, type FinanceKind } from "@/features/finance/FinanceFormModal";
import type { Invoice, Expense, Income } from "@/lib/types";
import { dt, money } from "@/lib/format";

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

const C = {
  brand:   "var(--brand)",
  chart1:  "var(--chart-1)",
  chart2:  "var(--chart-2)",
  chart3:  "var(--chart-3)",
  border:  "var(--border)",
  muted:   "var(--muted)",
};

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return isoDate(d);
}

// Helpers for <input type="datetime-local">. Local-time string ↔ ISO.
function toLocalDt(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string) {
  if (!local) return undefined;
  return new Date(local).toISOString();
}

export default function TransactionsPage() {
  const { push } = useToast();
  const isAdmin = useAdminGuard();
  const [tab, setTab] = useState<Tab>("transactions");

  // ── Transactions ───────────────────────────────────────────────────────────
  const [rows, setRows] = useState<Invoice[]>([]);
  const [invoiceDeleteTarget, setInvoiceDeleteTarget] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");   // local datetime string
  const [to, setTo] = useState("");       // local datetime string
  const [method, setMethod] = useState("All");
  const [kind, setKind] = useState<TxKind>("all");
  const [sortBy, setSortBy] = useState<SortBy>("issued_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const [analyticsFrom, setAnalyticsFrom] = useState(monthsAgo(5));
  const [analyticsTo, setAnalyticsTo] = useState(isoDate(new Date()));
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [retention, setRetention] = useState<RetentionPoint[]>([]);
  const [avgVisits, setAvgVisits] = useState<AvgVisitsPoint[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMembersPoint[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Finance (Expenses & Income) ─────────────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFrom, setFinanceFrom] = useState("");
  const [financeTo, setFinanceTo] = useState("");
  const [financeMethod, setFinanceMethod] = useState("All");
  const [financeSearch, setFinanceSearch] = useState("");
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
    if (tab !== "transactions") return;
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
  }, [refresh, tab]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const fromIso = new Date(analyticsFrom).toISOString();
      const toIso = new Date(new Date(analyticsTo).getTime() + 86400000 - 1).toISOString();
      const [sum, rev, ret, avg, active, top] = await Promise.all([
        getAnalyticsSummary(),
        getDailyRevenue(fromIso, toIso),
        getRetentionByMonth(fromIso, toIso),
        getAvgVisitsByMonth(fromIso, toIso),
        getActiveMembersByMonth(fromIso, toIso),
        getTopCustomers(10),
      ]);
      setSummary(sum);
      setDailyRevenue(rev);
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
    if (tab !== "analytics") return;
    loadAnalytics();
  }, [tab, loadAnalytics]);

  const loadFinance = useCallback(async () => {
    setFinanceLoading(true);
    try {
      const filters = {
        from: localToIso(financeFrom),
        to: localToIso(financeTo),
        paymentMethod: financeMethod,
        search: financeSearch,
      };
      const [exp, inc, sum] = await Promise.all([
        listExpenses(filters),
        listIncomes(filters),
        getFinanceSummary(),
      ]);
      setExpenses(exp);
      setIncomes(inc);
      setFinanceSummary(sum);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setFinanceLoading(false);
    }
  }, [financeFrom, financeTo, financeMethod, financeSearch, push]);

  useEffect(() => {
    if (tab !== "finance") return;
    const t = setTimeout(loadFinance, 200);
    return () => clearTimeout(t);
  }, [tab, loadFinance]);

  const displayedRows = useMemo(() => {
    if (filtersActive) return rows;
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page, filtersActive]);

  const totalPages = filtersActive ? 1 : Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const totals = useMemo(() => {
    const src = filtersActive ? rows : displayedRows;
    return {
      sum: src.reduce((s, r) => s + Number(r.total_amount), 0),
      sessions: src.reduce((s, r) => s + Number(r.session_amount), 0),
      orders: src.reduce((s, r) => s + Number(r.orders_amount), 0),
      count: rows.length,
    };
  }, [rows, displayedRows, filtersActive]);

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
            <div className="card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border px-3 py-1.5"
                  style={{ borderColor: "var(--border)" }}>
                  <Search className="h-4 w-4" style={{ color: "var(--muted)" }} />
                  <input className="input !border-0 !shadow-none !py-1"
                    placeholder="Search customer / subscriber name…"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div>
                  <label className="label">From (date &amp; time)</label>
                  <input type="datetime-local" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label">To (date &amp; time)</label>
                  <input type="datetime-local" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div>
                  <label className="label">Payment</label>
                  <select className="input mt-1" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                {(from || to) && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => { setFrom(""); setTo(""); }}
                    title="Clear date filter"
                  >
                    Clear range
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex rounded-xl border p-1" style={{ borderColor: "var(--border)" }}>
                  {KINDS.map((k) => {
                    const active = kind === k.value;
                    return (
                      <button key={k.value} onClick={() => setKind(k.value)}
                        className="rounded-lg px-3 py-1.5 text-sm transition"
                        style={active ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text)" }}>
                        {k.label}
                      </button>
                    );
                  })}
                </div>
                {filtersActive && (
                  <span className="badge" style={{ background: "var(--brand)", color: "#fff" }}>
                    Filters active — {rows.length} results
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Transactions" value={String(totals.count)} />
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
            <div className="card p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label">From</label>
                  <input type="date" className="input mt-1" value={analyticsFrom}
                    onChange={(e) => setAnalyticsFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label">To</label>
                  <input type="date" className="input mt-1" value={analyticsTo}
                    onChange={(e) => setAnalyticsTo(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={loadAnalytics}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
            </div>

            {analyticsLoading && (
              <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>
                Loading analytics…
              </div>
            )}

            {summary && !analyticsLoading && (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                  <KpiCard label="Customers" value={String(summary.totalCustomers)} icon={<Users className="h-4 w-4" />} />
                  <KpiCard label="Subscribers" value={String(summary.totalSubscribers)} icon={<Users className="h-4 w-4" />} />
                  <KpiCard label="Active Now" value={String(summary.activeSubscribersNow)} icon={<Activity className="h-4 w-4" />} accent />
                  <KpiCard label="Avg Visits" value={`${summary.avgVisitsPerCustomer}×`} icon={<TrendingUp className="h-4 w-4" />} />
                  <KpiCard label="Retention (30d)" value={`${summary.retentionRate}%`} icon={<RefreshCw className="h-4 w-4" />} accent />
                  <KpiCard label="Total Sessions" value={String(summary.totalSessions)} icon={<BarChart2 className="h-4 w-4" />} />
                </div>

                {dailyRevenue.length > 0 && (
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-sm">Revenue Over Time</p>
                        <p className="label mt-0.5">Sessions · Orders · Subscriptions</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Legend color={C.chart1} label="Sessions" />
                        <Legend color={C.chart2} label="Orders" />
                        <Legend color={C.chart3} label="Subscriptions" />
                      </div>
                    </div>
                    <StackedBarChart
                      data={dailyRevenue.map((d) => ({
                        label: d.date.slice(5),
                        stacks: [d.sessions, d.orders, d.subscriptions],
                      }))}
                      colors={[C.chart1, C.chart2, C.chart3]}
                      formatTip={(v) => money(v)}
                      height={120}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {retention.length > 0 && (
                    <div className="card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">Retention Rate</p>
                          <p className="label mt-0.5">% of visitors who came back</p>
                        </div>
                        <span className="badge text-xs font-semibold" style={{ background: "var(--brand)", color: "#fff" }}>
                          {retention.at(-1)?.retentionRate ?? 0}% latest
                        </span>
                      </div>
                      <LineSparkline
                        data={retention.map((r) => ({ label: r.month.slice(5), value: r.retentionRate }))}
                        color={C.brand}
                        yMax={100}
                        height={80}
                        formatTip={(v) => `${v}%`}
                      />
                      <div className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
                        {retention.map((r) => (
                          <div key={r.month} className="flex items-center justify-between py-1.5 text-xs">
                            <span style={{ color: "var(--muted)" }}>{r.month}</span>
                            <div className="flex gap-3">
                              <span style={{ color: "var(--muted)" }}>New <b style={{ color: "var(--text)" }}>{r.new}</b></span>
                              <span style={{ color: "var(--muted)" }}>Return <b style={{ color: "var(--text)" }}>{r.returning}</b></span>
                              <span className="font-semibold" style={{ color: "var(--brand)" }}>{r.retentionRate}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {avgVisits.length > 0 && (
                    <div className="card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">Avg Visits / Customer</p>
                          <p className="label mt-0.5">Sessions ÷ unique visitors</p>
                        </div>
                        <span className="badge text-xs font-semibold" style={{ background: "var(--border)", color: "var(--text)" }}>
                          {avgVisits.at(-1)?.avgVisits ?? 0}× latest
                        </span>
                      </div>
                      <LineSparkline
                        data={avgVisits.map((r) => ({ label: r.month.slice(5), value: r.avgVisits }))}
                        color={C.chart2}
                        height={80}
                        formatTip={(v) => `${v}×`}
                      />
                      <div className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
                        {avgVisits.map((r) => (
                          <div key={r.month} className="flex items-center justify-between py-1.5 text-xs">
                            <span style={{ color: "var(--muted)" }}>{r.month}</span>
                            <div className="flex gap-3">
                              <span style={{ color: "var(--muted)" }}>Unique <b style={{ color: "var(--text)" }}>{r.uniqueCustomers}</b></span>
                              <span style={{ color: "var(--muted)" }}>Sessions <b style={{ color: "var(--text)" }}>{r.totalVisits}</b></span>
                              <span className="font-semibold" style={{ color: C.chart2 }}>{r.avgVisits}×</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeMembers.length > 0 && (
                    <div className="card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">Active Members</p>
                          <p className="label mt-0.5">Subscribers with a session that month</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Legend color={C.brand} label="Active" />
                          <Legend color={C.border} label="Inactive" />
                        </div>
                      </div>
                      <ActiveMembersChart data={activeMembers} height={80} />
                      <div className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
                        {activeMembers.map((r) => (
                          <div key={r.month} className="flex items-center justify-between py-1.5 text-xs">
                            <span style={{ color: "var(--muted)" }}>{r.month}</span>
                            <div className="flex gap-3">
                              <span style={{ color: "var(--muted)" }}>Total <b style={{ color: "var(--text)" }}>{r.totalSubscribers}</b></span>
                              <span style={{ color: "var(--muted)" }}>Active <b style={{ color: "var(--text)" }}>{r.activeSubscribers}</b></span>
                              <span className="font-semibold" style={{ color: "var(--brand)" }}>{r.activeRate}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {topCustomers.length > 0 && (
                    <div className="card p-4">
                      <p className="font-semibold text-sm mb-3">Top Customers</p>
                      <div className="space-y-3">
                        {topCustomers.map((c, i) => {
                          const pct = Math.round((c.visits / topCustomers[0].visits) * 100);
                          return (
                            <div key={c.name}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-mono w-5 text-right shrink-0" style={{ color: "var(--muted)" }}>
                                    {i + 1}
                                  </span>
                                  <span className="text-sm font-medium truncate">{c.name}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  <span className="text-xs" style={{ color: "var(--muted)" }}>{c.visits}×</span>
                                  <span className="text-xs font-medium">{money(c.totalSpend)}</span>
                                </div>
                              </div>
                              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--brand)", transition: "width 0.4s ease" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
            <div className="card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border px-3 py-1.5"
                  style={{ borderColor: "var(--border)" }}>
                  <Search className="h-4 w-4" style={{ color: "var(--muted)" }} />
                  <input className="input !border-0 !shadow-none !py-1"
                    placeholder="Search expense / income name…"
                    value={financeSearch} onChange={(e) => setFinanceSearch(e.target.value)} />
                </div>
                <div>
                  <label className="label">From (date &amp; time)</label>
                  <input type="datetime-local" className="input mt-1" value={financeFrom}
                    onChange={(e) => setFinanceFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label">To (date &amp; time)</label>
                  <input type="datetime-local" className="input mt-1" value={financeTo}
                    onChange={(e) => setFinanceTo(e.target.value)} />
                </div>
                <div>
                  <label className="label">Payment</label>
                  <select className="input mt-1" value={financeMethod} onChange={(e) => setFinanceMethod(e.target.value)}>
                    {METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
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
                  label="Net Profit (System-wide)"
                  value={money(financeSummary.netProfit)}
                  sublabel={`Total income ${money(financeSummary.totalSystemIncome)} · Total expenses ${money(financeSummary.totalSystemExpenses)}`}
                  icon={<Wallet className="h-4 w-4" />}
                  accentColor={financeSummary.netProfit >= 0 ? "var(--brand)" : "#c2410c"}
                />
              </div>
            )}

            {/* Income vs Expenses bar */}
            {financeSummary && (
              <div className="card p-4">
                <p className="font-semibold text-sm mb-3">Income vs Expenses — This Month</p>
                <BarCompare
                  income={financeSummary.monthIncome}
                  expenses={financeSummary.monthExpenses}
                />
              </div>
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
    <div className="card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="label">{label}</span>
        <span style={{ color: accent ? "var(--brand)" : "var(--muted)" }}>{icon}</span>
      </div>
      <div className="text-xl font-bold" style={accent ? { color: "var(--brand)" } : undefined}>{value}</div>
    </div>
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
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

function BarCompare({ income, expenses }: { income: number; expenses: number }) {
  const max = Math.max(income, expenses, 1);
  const incomePct = Math.round((income / max) * 100);
  const expensePct = Math.round((expenses / max) * 100);
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: "var(--muted)" }}>Income</span>
          <span className="font-semibold">{money(income)}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${incomePct}%`, background: "var(--chart-1)", transition: "width 0.4s ease" }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: "var(--muted)" }}>Expenses</span>
          <span className="font-semibold">{money(expenses)}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${expensePct}%`, background: "var(--chart-4)", transition: "width 0.4s ease" }}
          />
        </div>
      </div>
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

// ─── SVG chart primitives ─────────────────────────────────────────────────────

const PAD = { l: 32, r: 8, t: 6, b: 20 };

function yTick(maxVal: number, frac: number, chartH: number, padT: number) {
  return padT + chartH * (1 - frac);
}

function StackedBarChart({
  data, colors, height = 120,
}: {
  data: { label: string; stacks: number[] }[];
  colors: string[];
  formatTip: (v: number) => string;
  height?: number;
}) {
  const sPAD = { l: 72, r: 8, t: 6, b: 20 };
  const W = 560; const H = height;
  const cW = W - sPAD.l - sPAD.r;
  const cH = H - sPAD.t - sPAD.b;
  const baseline = sPAD.t + cH;
  const maxVal = Math.max(...data.map((d) => d.stacks.reduce((a, b) => a + b, 0)), 1);
  const step = cW / Math.max(data.length, 1);
  const bW = Math.min(32, Math.max(4, step * 0.55));

  const bars = data.map((d, i) => {
    const cx = sPAD.l + i * step + step / 2;
    const x = cx - bW / 2;
    let cumH = 0;
    const segs = d.stacks.map((v, si) => {
      const bh = (v / maxVal) * cH;
      const seg = { si, x, y: baseline - cumH - bh, width: bW, height: bh, color: colors[si] ?? "var(--border)" };
      cumH += bh;
      return seg;
    });
    return { d, cx, x, segs };
  });

  const skipEvery = data.length > 14 ? Math.ceil(data.length / 14) : 1;

  const shortVal = (v: number) => {
    if (v === 0) return "0";
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      {[0, 0.5, 1].map((f) => {
        const y = yTick(maxVal, f, cH, sPAD.t);
        return (
          <g key={f}>
            <line x1={sPAD.l} x2={W - sPAD.r} y1={y} y2={y}
              stroke="var(--border)" strokeWidth={1} strokeDasharray={f === 0 ? "0" : "3 3"} />
            {f > 0 && (
              <text x={sPAD.l - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--muted)">
                {shortVal(maxVal * f)}
              </text>
            )}
          </g>
        );
      })}
      {bars.map(({ d, cx, segs }, i) => (
        <g key={d.label}>
          {segs.map((s) =>
            s.height > 0 && (
              <rect key={s.si} x={s.x} y={s.y} width={s.width} height={s.height}
                fill={s.color} rx={1.5} />
            )
          )}
          {i % skipEvery === 0 && (
            <text x={cx} y={H - sPAD.b + 12} textAnchor="middle" fontSize={7} fill="var(--muted)">
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function LineSparkline({
  data, color, yMax, height = 80, formatTip,
}: {
  data: { label: string; value: number }[];
  color: string;
  yMax?: number;
  height?: number;
  formatTip: (v: number) => string;
}) {
  const W = 400; const H = height;
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const maxVal = yMax ?? Math.max(...data.map((d) => d.value), 1);
  const step = data.length > 1 ? cW / (data.length - 1) : cW;

  const pts = data.map((d, i) => ({
    x: PAD.l + i * step,
    y: PAD.t + cH * (1 - d.value / maxVal),
    d,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = pts.length
    ? `${linePath} L${pts.at(-1)!.x},${PAD.t + cH} L${pts[0].x},${PAD.t + cH}Z`
    : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      {[0, 0.5, 1].map((f) => {
        const y = yTick(maxVal, f, cH, PAD.t);
        return (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
              stroke="var(--border)" strokeWidth={1} strokeDasharray={f === 0 ? "0" : "3 3"} />
            <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--muted)">
              {formatTip(maxVal * f)}
            </text>
          </g>
        );
      })}
      {areaPath && <path d={areaPath} fill={color} fillOpacity={0.08} />}
      {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p) => (
        <g key={p.d.label}>
          <circle cx={p.x} cy={p.y} r={2.5} fill={color} />
          <text x={p.x} y={H - PAD.b + 12} textAnchor="middle" fontSize={7} fill="var(--muted)">{p.d.label}</text>
        </g>
      ))}
    </svg>
  );
}

function ActiveMembersChart({ data, height = 80 }: { data: ActiveMembersPoint[]; height?: number }) {
  const W = 400; const H = height;
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...data.map((d) => d.totalSubscribers), 1);
  const bW = Math.max(3, Math.floor(cW / data.length) - 4);
  const step = cW / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      {[0, 0.5, 1].map((f) => {
        const y = yTick(maxVal, f, cH, PAD.t);
        return (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
              stroke="var(--border)" strokeWidth={1} strokeDasharray={f === 0 ? "0" : "3 3"} />
            <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--muted)">
              {Math.round(maxVal * f)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = PAD.l + i * step + (step - bW) / 2;
        const inactiveH = Math.max(0, ((d.totalSubscribers - d.activeSubscribers) / maxVal) * cH);
        const activeH = Math.max(0, (d.activeSubscribers / maxVal) * cH);
        return (
          <g key={d.month}>
            <rect x={x} y={PAD.t + cH - inactiveH - activeH} width={bW} height={inactiveH}
              fill="var(--border)" rx={1.5} />
            <rect x={x} y={PAD.t + cH - activeH} width={bW} height={activeH}
              fill="var(--brand)" rx={1.5} />
            <text x={x + bW / 2} y={H - PAD.b + 12} textAnchor="middle" fontSize={7} fill="var(--muted)">
              {d.month.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
