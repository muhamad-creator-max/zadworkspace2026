"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Play, LogOut, Pencil, Trash2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { CustomerFormModal } from "@/features/customers/CustomerFormModal";
import { StartSessionModal } from "@/features/sessions/StartSessionModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  listCustomers,
  listSubscribers,
  searchPeople,
  softDeleteCustomer,
  findActiveSessionForPerson,
} from "@/features/customers/api";
import type { Customer, Subscriber } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { dt } from "@/lib/format";

type Hit =
  | { kind: "customer"; c: Customer; activeSessionId?: string }
  | { kind: "subscriber"; s: Subscriber; activeSessionId?: string };

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Hit[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const [startFor, setStartFor] = useState<Hit | null>(null);
  const [endConfirm, setEndConfirm] = useState<{ hit: Hit; sessionId: string } | null>(null);

  const router = useRouter();
  const { push } = useToast();

  const refresh = async () => {
    const [cs, ss] = await Promise.all([listCustomers(), listSubscribers()]);
    const merged: Hit[] = [
      ...cs.map((c) => ({ kind: "customer" as const, c })),
      ...ss.map((s) => ({ kind: "subscriber" as const, s })),
    ];
    // Sort by created_at descending
    merged.sort((a, b) => {
      const dateA = a.kind === "customer" ? a.c.created_at : a.s.created_at;
      const dateB = b.kind === "customer" ? b.c.created_at : b.s.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    setPeople(merged);
  };

  useEffect(() => {
    refresh().catch((e) => push({ kind: "err", msg: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { customers: cs, subscribers: ss } = await searchPeople(query.trim());
        const enriched: Hit[] = await Promise.all([
          ...cs.map(async (c) => {
            const active = await findActiveSessionForPerson({ customer_id: c.id });
            return { kind: "customer" as const, c, activeSessionId: active?.id };
          }),
          ...ss.map(async (s) => {
            const active = await findActiveSessionForPerson({ subscriber_id: s.id });
            return { kind: "subscriber" as const, s, activeSessionId: active?.id };
          }),
        ]);
        setHits(enriched);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const noResults = useMemo(
    () => query.trim().length > 0 && !searching && hits.length === 0,
    [query, searching, hits]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteCustomer(deleteTarget.id);
      push({ kind: "ok", msg: "Customer removed" });
      setDeleteTarget(null);
      refresh();
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  return (
    <>
      <Topbar title="Customers" />
      <div className="p-5">
        {/* SEARCH BAR */}
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" style={{ color: "var(--muted)" }} />
            <input
              className="input !border-0 !shadow-none"
              placeholder="Search by name or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary shrink-0" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add customer
            </button>
          </div>

          {/* RESULTS */}
          {query.trim() && (
            <div className="mt-3 space-y-2">
              {searching && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>Searching…</p>
              )}
              {hits.map((h, i) => (
                <ResultRow
                  key={i}
                  hit={h}
                  onStartSession={() => setStartFor(h)}
                  onEndSession={() =>
                    setEndConfirm({ hit: h, sessionId: h.activeSessionId! })
                  }
                />
              ))}
              {noResults && (
                <button
                  className="btn btn-ghost w-full justify-center"
                  onClick={() => setAddOpen(true)}
                >
                  <UserPlus className="h-4 w-4" /> + Add new customer "{query}"
                </button>
              )}
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="card mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border)" }}>
            <div className="font-medium">All people</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {people.length} total
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-zad">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Study/Code</th>
                  <th>Phone</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((h) => {
                  const isSub = h.kind === "subscriber";
                  const id = isSub ? h.s.id : h.c.id;
                  const name = isSub ? h.s.name : h.c.name;
                  const phone = isSub ? h.s.phone : h.c.phone;
                  const created_at = isSub ? h.s.created_at : h.c.created_at;
                  const detail = isSub ? h.s.code : h.c.study || "—";

                  return (
                    <tr key={id}>
                      <td className="font-medium">{name}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: isSub ? "var(--brand)" : "var(--bg-hover)",
                            color: isSub ? "#fff" : "inherit",
                            fontSize: "10px",
                          }}
                        >
                          {isSub ? "Subscriber" : "Customer"}
                        </span>
                      </td>
                      <td>{detail}</td>
                      <td>{phone}</td>
                      <td>{dt(created_at)}</td>
                      <td className="text-right">
                        {!isSub && (
                          <>
                            <button
                              className="btn btn-ghost !px-2 !py-1"
                              onClick={() => setEditTarget(h.c)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="btn btn-ghost !px-2 !py-1 ml-1"
                              onClick={() => setDeleteTarget(h.c)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {isSub && (
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            Read-only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!people.length && (
                  <tr>
                    <td colSpan={6} className="text-center" style={{ color: "var(--muted)" }}>
                      No people yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <CustomerFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prefillName={query}
        onSaved={() => refresh()}
      />
      <CustomerFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        initial={editTarget}
        onSaved={() => refresh()}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove customer?"
        message="The customer will be hidden from lists but past sessions and invoices stay intact."
        confirmLabel="Remove"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <StartSessionModal
        open={!!startFor}
        onClose={() => setStartFor(null)}
        customerId={startFor?.kind === "customer" ? startFor.c.id : undefined}
        subscriberId={startFor?.kind === "subscriber" ? startFor.s.id : undefined}
        personLabel={
          startFor
            ? startFor.kind === "customer"
              ? startFor.c.name
              : `${startFor.s.name} (${startFor.s.code})`
            : ""
        }
        onStarted={() => {
          setStartFor(null);
          setQuery((q) => q); // trigger re-search
        }}
      />
      <ConfirmDialog
        open={!!endConfirm}
        title="End session and checkout?"
        message="This will close the session and take you to checkout. This cannot be undone."
        confirmLabel="End session"
        destructive
        onCancel={() => setEndConfirm(null)}
        onConfirm={() => {
          const id = endConfirm!.sessionId;
          setEndConfirm(null);
          router.push(`/checkout/${id}`);
        }}
      />
    </>
  );
}

function ResultRow({
  hit,
  onStartSession,
  onEndSession,
}: {
  hit: Hit;
  onStartSession: () => void;
  onEndSession: () => void;
}) {
  const isSub = hit.kind === "subscriber";
  const name = isSub ? hit.s.name : hit.c.name;
  const phone = isSub ? hit.s.phone : hit.c.phone;
  const study = isSub ? "—" : hit.c.study || "—";
  const code = isSub ? hit.s.code : null;

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {isSub && (
            <span
              className="badge"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Subscriber · {code}
            </span>
          )}
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {phone} • {study}
        </div>
      </div>
      {hit.activeSessionId ? (
        <button className="btn btn-danger" onClick={onEndSession}>
          <LogOut className="h-4 w-4" /> End session
        </button>
      ) : (
        <button className="btn btn-primary" onClick={onStartSession}>
          <Play className="h-4 w-4" /> Start new session
        </button>
      )}
    </div>
  );
}
