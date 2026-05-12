"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, ExternalLink } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { listTransactions, type TxKind } from "@/features/transactions/api";
import type { Invoice } from "@/lib/types";
import { dt, money } from "@/lib/format";

const METHODS = ["All", "Cash", "Card", "Mobile Wallet", "Instapay"];
const KINDS: { value: TxKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "session", label: "Sessions" },
  { value: "orders", label: "Orders" },
  { value: "subscription", label: "Subscriptions" },
];
type SortBy = "issued_at" | "total_amount" | "customer_name";

export default function TransactionsPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("All");
  const [kind, setKind] = useState<TxKind>("all");
  const [sortBy, setSortBy] = useState<SortBy>("issued_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const refresh = async () => {
    try {
      const data = await listTransactions({
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(new Date(to).getTime() + 86400000 - 1).toISOString() : undefined,
        paymentMethod: method,
        kind,
        search,
        sortBy,
        sortDir,
      });
      setRows(data);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, from, to, method, kind, sortBy, sortDir]);

  const totals = useMemo(() => {
    const sum = rows.reduce((s, r) => s + Number(r.total_amount), 0);
    const sessions = rows.reduce((s, r) => s + Number(r.session_amount), 0);
    const orders = rows.reduce((s, r) => s + Number(r.orders_amount), 0);
    return { sum, sessions, orders, count: rows.length };
  }, [rows]);

  const toggleSort = (col: SortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  return (
    <>
      <Topbar title="Orders & Sessions" />
      <div className="p-5 space-y-4">
        {/* FILTERS */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border px-3 py-1.5"
                 style={{ borderColor: "var(--border)" }}>
              <Search className="h-4 w-4" style={{ color: "var(--muted)" }} />
              <input
                className="input !border-0 !shadow-none !py-1"
                placeholder="Search customer / subscriber name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="label">From</label>
              <input type="date" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="label">Payment</label>
              <select className="input mt-1" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Kind switch */}
          <div className="inline-flex rounded-xl border p-1" style={{ borderColor: "var(--border)" }}>
            {KINDS.map((k) => {
              const active = kind === k.value;
              return (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className="rounded-lg px-3 py-1.5 text-sm transition"
                  style={active
                    ? { background: "var(--brand)", color: "#fff" }
                    : { color: "var(--text)" }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Transactions" value={String(totals.count)} />
          <Stat label="Sessions revenue" value={money(totals.sessions)} />
          <Stat label="Orders revenue" value={money(totals.orders)} />
          <Stat label="Total" value={money(totals.sum)} accent />
        </div>

        {/* TABLE */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-zad">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>
                    <SortBtn label="Customer" active={sortBy === "customer_name"} dir={sortDir}
                      onClick={() => toggleSort("customer_name")} />
                  </th>
                  <th>Items</th>
                  <th className="text-right">
                    <SortBtn label="Total" active={sortBy === "total_amount"} dir={sortDir}
                      onClick={() => toggleSort("total_amount")} />
                  </th>
                  <th>Payment</th>
                  <th>Staff</th>
                  <th>
                    <SortBtn label="Date" active={sortBy === "issued_at"} dir={sortDir}
                      onClick={() => toggleSort("issued_at")} />
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
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
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="text-center" style={{ color: "var(--muted)" }}>
                      No transactions match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-lg font-semibold"
           style={accent ? { color: "var(--brand)" } : undefined}>{value}</div>
    </div>
  );
}

function SortBtn({
  label, active, dir, onClick,
}: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1">
      {label} <ArrowUpDown className="h-3 w-3" style={{ opacity: active ? 1 : 0.4 }} />
      {active && <span className="text-[10px]">{dir}</span>}
    </button>
  );
}
