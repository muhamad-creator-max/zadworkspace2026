"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trash2, RefreshCw, Search,
  Receipt, CalendarClock, User, IdCard,
  BookOpen, DoorOpen, Package, Users, Wallet,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { listDeleteLog } from "@/features/finance/api";
import type { DeleteLogEntry } from "@/lib/types";
import { dt, money } from "@/lib/format";

// ─── tab config ──────────────────────────────────────────────────────────────

const TABS = [
  { key: "all",           label: "All",         icon: Trash2,       types: null },
  { key: "transactions",  label: "Transactions", icon: Receipt,      types: ["invoice"] },
  { key: "sessions",      label: "Sessions",     icon: CalendarClock,types: ["session"] },
  { key: "customers",     label: "Customers",    icon: User,         types: ["customer"] },
  { key: "subscribers",   label: "Subscribers",  icon: IdCard,       types: ["subscriber"] },
  { key: "plans",         label: "Plans",        icon: BookOpen,     types: ["plan"] },
  { key: "rooms",         label: "Rooms",        icon: DoorOpen,     types: ["room"] },
  { key: "inventory",     label: "Inventory",    icon: Package,      types: ["inventory_item"] },
  { key: "staff",         label: "Staff",        icon: Users,        types: ["staff_member"] },
  { key: "finance",       label: "Finance",      icon: Wallet,       types: ["expense", "income"] },
] as const;

// ─── colour map ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  invoice:        { bg: "#354A37", color: "#fff" },
  session:        { bg: "#3B6EA8", color: "#fff" },
  customer:       { bg: "#A77BCA", color: "#fff" },
  subscriber:     { bg: "#2F8C6A", color: "#fff" },
  plan:           { bg: "#E2A55E", color: "#fff" },
  room:           { bg: "#D9534F", color: "#fff" },
  inventory_item: { bg: "#5B6E8C", color: "#fff" },
  staff_member:   { bg: "#444",    color: "#fff" },
  expense:        { bg: "#FAA9A9", color: "#5a1414" },
  income:         { bg: "#D0FFB6", color: "#1d3a16" },
};

const TYPE_LABELS: Record<string, string> = {
  invoice:        "Invoice",
  session:        "Session",
  customer:       "Customer",
  subscriber:     "Subscriber",
  plan:           "Plan",
  room:           "Room",
  inventory_item: "Inventory",
  staff_member:   "Staff",
  expense:        "Expense",
  income:         "Income",
};

// ─── snapshot helpers ─────────────────────────────────────────────────────────

function snap(r: DeleteLogEntry): Record<string, any> {
  return (r.snapshot as Record<string, any>) ?? {};
}

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_COLORS[type] ?? { bg: "var(--border)", color: "var(--text)" };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <span className="text-xs" style={{ color: "var(--muted)" }}>
      <span className="font-medium" style={{ color: "var(--text)" }}>{label}:</span> {value}
    </span>
  );
}

function Actor({ r }: { r: DeleteLogEntry }) {
  return (
    <div>
      <div className="font-medium text-sm">{r.deleted_by}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{dt(r.deleted_at)}</div>
    </div>
  );
}

// ─── per-type row renderers ───────────────────────────────────────────────────

function InvoiceRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td><TypeBadge type={r.entity_type} /></td>
      <td>
        <div className="font-medium">{s.customer_name ?? "—"}</div>
        <div className="flex gap-3 mt-0.5 flex-wrap">
          <Meta label="Kind" value={s.kind} />
          <Meta label="Payment" value={s.payment_method} />
          <Meta label="By" value={s.created_by} />
        </div>
      </td>
      <td className="text-right">
        <div className="font-semibold">{money(Number(s.total_amount ?? 0))}</div>
        {Number(s.orders_amount) > 0 && (
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            +{money(Number(s.orders_amount))} orders
          </div>
        )}
      </td>
      <td><Meta label="" value={s.issued_at ? dt(s.issued_at) : null} /></td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function SessionRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  const segments: any[] = s.session_segments ?? [];
  return (
    <tr>
      <td><TypeBadge type={r.entity_type} /></td>
      <td>
        <div className="font-medium">{s.customer_name ?? s.subscriber_name ?? "—"}</div>
        <div className="flex gap-3 mt-0.5 flex-wrap">
          <Meta label="Room" value={s.room_name ?? s.room?.name} />
          {segments.length > 1 && <Meta label="Segments" value={String(segments.length)} />}
          <Meta label="By" value={s.created_by} />
        </div>
      </td>
      <td>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {s.started_at ? dt(s.started_at) : "—"}
        </div>
        {s.ended_at && (
          <div className="text-xs" style={{ color: "var(--muted)" }}>→ {dt(s.ended_at)}</div>
        )}
      </td>
      <td className="text-right">
        {s.duration_minutes != null
          ? <span className="font-medium">{Number(s.duration_minutes).toFixed(0)} min</span>
          : "—"}
      </td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function CustomerRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td><TypeBadge type={r.entity_type} /></td>
      <td className="font-medium">{s.name ?? r.entity_label ?? "—"}</td>
      <td>{s.phone ?? "—"}</td>
      <td>{s.study ?? "—"}</td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function SubscriberRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td><TypeBadge type={r.entity_type} /></td>
      <td>
        <div className="font-medium">{s.name ?? "—"}</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>{s.code}</div>
      </td>
      <td>{s.phone ?? "—"}</td>
      <td>
        <div className="text-sm">{s.total_hours}h total</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {Number(s.hours_remaining ?? 0).toFixed(1)}h remaining
        </div>
      </td>
      <td>
        {s.expires_at ? (
          <div className="text-sm">{new Date(s.expires_at).toLocaleDateString()}</div>
        ) : "—"}
      </td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function PlanRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td>
        <span
          className="badge"
          style={{ background: s.label_color ?? "#888", color: "#fff" }}
        >
          {s.letter ?? ""} {s.name ?? r.entity_label ?? "—"}
        </span>
      </td>
      <td>{s.hours != null ? `${s.hours}h` : "—"}</td>
      <td>{s.available_seats ?? "—"} seats</td>
      <td>{s.expiration_days != null ? `${s.expiration_days} days` : "—"}</td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function RoomRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td>
        <span
          className="badge"
          style={{ background: s.label_color ?? "#888", color: "#fff" }}
        >
          {s.name ?? r.entity_label ?? "—"}
        </span>
      </td>
      <td>{s.capacity != null ? `${s.capacity} people` : "—"}</td>
      <td className="text-sm" style={{ color: "var(--muted)" }}>{s.description ?? "—"}</td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function InventoryRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td><TypeBadge type={r.entity_type} /></td>
      <td className="font-medium">{s.name ?? r.entity_label ?? "—"}</td>
      <td>
        <span className="badge" style={{ background: "var(--border)", color: "var(--text)" }}>
          {s.category ?? "—"}
        </span>
      </td>
      <td className="text-right font-semibold">{money(Number(s.price ?? 0))}</td>
      <td className="text-right">{s.stock ?? "—"} units</td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function StaffRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td className="font-medium">{s.name ?? r.entity_label ?? "—"}</td>
      <td>{s.email ?? "—"}</td>
      <td>
        <span className="badge" style={{
          background: s.role === "admin" ? "var(--brand)" : "var(--border)",
          color: s.role === "admin" ? "#fff" : "var(--text)",
        }}>
          {s.role ?? "—"}
        </span>
      </td>
      <td>{s.phone ?? "—"}</td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function FinanceRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  const isExpense = r.entity_type === "expense";
  return (
    <tr>
      <td>
        <span className="badge" style={{
          background: isExpense ? "#FAA9A9" : "#D0FFB6",
          color: isExpense ? "#5a1414" : "#1d3a16",
        }}>
          {isExpense ? "Expense" : "Income"}
        </span>
      </td>
      <td>
        <div className="font-medium">{s.name ?? r.entity_label ?? "—"}</div>
        {s.reason && <div className="text-xs" style={{ color: "var(--muted)" }}>{s.reason}</div>}
      </td>
      <td className="text-right font-semibold">{money(Number(s.amount ?? 0))}</td>
      <td>{s.payment_method ?? "—"}</td>
      <td>{s.payment_due ? dt(s.payment_due) : "—"}</td>
      <td>
        <div className="text-sm">{s.created_by ?? "—"}</div>
      </td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

function AllRow({ r }: { r: DeleteLogEntry }) {
  const s = snap(r);
  return (
    <tr>
      <td><TypeBadge type={r.entity_type} /></td>
      <td className="font-medium">{r.entity_label ?? "—"}</td>
      <td className="text-sm" style={{ color: "var(--muted)" }}>
        {(() => {
          switch (r.entity_type) {
            case "invoice": return `${s.kind ?? ""} · ${s.payment_method ?? ""}`;
            case "session": return `${s.room_name ?? s.room?.name ?? ""} · ${s.duration_minutes != null ? `${Number(s.duration_minutes).toFixed(0)} min` : ""}`;
            case "customer": return s.phone ?? "";
            case "subscriber": return `${s.code ?? ""} · ${s.total_hours}h`;
            case "plan": return `${s.hours}h · ${s.available_seats} seats`;
            case "room": return `Capacity ${s.capacity}`;
            case "inventory_item": return `${s.category} · Stock ${s.stock}`;
            case "staff_member": return `${s.role} · ${s.email ?? ""}`;
            case "expense":
            case "income": return s.payment_method ?? "";
            default: return "";
          }
        })()}
      </td>
      <td className="text-right font-medium">
        {r.entity_amount != null ? money(Number(r.entity_amount)) : "—"}
      </td>
      <td><Actor r={r} /></td>
    </tr>
  );
}

// ─── column headers per tab ───────────────────────────────────────────────────

const HEADERS: Record<string, string[]> = {
  all:          ["Type", "Name", "Detail", "Amount", "Deleted By"],
  transactions: ["Type", "Customer", "Total", "Issued At", "Deleted By"],
  sessions:     ["Type", "Customer", "Time Range", "Duration", "Deleted By"],
  customers:    ["Type", "Name", "Phone", "Study", "Deleted By"],
  subscribers:  ["Type", "Name", "Phone", "Hours", "Expires", "Deleted By"],
  plans:        ["Plan", "Hours", "Seats", "Expiry", "Deleted By"],
  rooms:        ["Room", "Capacity", "Description", "Deleted By"],
  inventory:    ["Type", "Name", "Category", "Price", "Stock", "Deleted By"],
  staff:        ["Name", "Email", "Role", "Phone", "Deleted By"],
  finance:      ["Type", "Name", "Amount", "Payment", "Due Date", "Added By", "Deleted By"],
};

function RowFor({ r, tab }: { r: DeleteLogEntry; tab: string }) {
  if (tab === "transactions") return <InvoiceRow r={r} />;
  if (tab === "sessions")     return <SessionRow r={r} />;
  if (tab === "customers")    return <CustomerRow r={r} />;
  if (tab === "subscribers")  return <SubscriberRow r={r} />;
  if (tab === "plans")        return <PlanRow r={r} />;
  if (tab === "rooms")        return <RoomRow r={r} />;
  if (tab === "inventory")    return <InventoryRow r={r} />;
  if (tab === "staff")        return <StaffRow r={r} />;
  if (tab === "finance")      return <FinanceRow r={r} />;
  return <AllRow r={r} />;
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DeleteLogPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<DeleteLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDeleteLog({ from: from || undefined, to: to || undefined });
      setRows(data);
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Failed to load delete log" });
    } finally {
      setLoading(false);
    }
  }, [from, to, push]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (currentTab.types) {
      const allowed = new Set(currentTab.types);
      result = result.filter((r) => allowed.has(r.entity_type as any));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          (r.entity_label ?? "").toLowerCase().includes(q) ||
          r.deleted_by.toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, currentTab, search]);

  const headers = HEADERS[activeTab] ?? HEADERS.all;

  return (
    <>
      <Topbar title="Delete Log" />
      <div className="p-5 space-y-4">

        {/* TABS */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.types
              ? rows.filter((r) => (tab.types as readonly string[]).includes(r.entity_type)).length
              : rows.length;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: active ? "var(--brand)" : "var(--surface)",
                  color: active ? "#fff" : "var(--muted)",
                  border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <span
                    className="rounded-full px-1.5 text-xs"
                    style={{
                      background: active ? "rgba(255,255,255,0.25)" : "var(--border)",
                      color: active ? "#fff" : "var(--text)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* FILTER BAR */}
        <div className="card p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border px-3 py-1.5"
            style={{ borderColor: "var(--border)" }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--muted)" }} />
            <input
              className="input !border-0 !shadow-none !py-1"
              placeholder="Search name / deleted by…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="label">From</label>
            <input type="datetime-local" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="datetime-local" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <button className="btn btn-ghost" onClick={() => { setFrom(""); setTo(""); }}>
              Clear
            </button>
          )}
          <button className="btn btn-ghost" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {filteredRows.length} {filteredRows.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* TABLE */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-zad">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} className={h === "Total" || h === "Amount" || h === "Price" || h === "Stock" ? "text-right" : ""}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <RowFor key={r.id} r={r} tab={activeTab} />
                ))}
                {!filteredRows.length && (
                  <tr>
                    <td
                      colSpan={headers.length}
                      className="text-center py-12 text-sm"
                      style={{ color: "var(--muted)" }}
                    >
                      {loading ? "Loading…" : (
                        <span className="inline-flex flex-col items-center gap-2">
                          <Trash2 className="h-6 w-6 opacity-30" />
                          No deleted {currentTab.label.toLowerCase()} found.
                        </span>
                      )}
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
