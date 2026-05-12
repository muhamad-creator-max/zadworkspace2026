"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Play, Plus, LogOut } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { searchPeople, findActiveSessionForPerson } from "@/features/customers/api";
import { listActiveSessions } from "@/features/sessions/api";
import { StartSessionModal } from "@/features/sessions/StartSessionModal";
import { AddOrdersModal } from "@/features/sessions/AddOrdersModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { Customer, Session, Subscriber } from "@/lib/types";
import { dt, formatDuration, minutesBetween } from "@/lib/format";

type Hit =
  | { kind: "customer"; c: Customer; activeSessionId?: string }
  | { kind: "subscriber"; s: Subscriber; activeSessionId?: string };

export default function DashboardPage() {
  const router = useRouter();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [startFor, setStartFor] = useState<Hit | null>(null);
  const [addOrdersFor, setAddOrdersFor] = useState<Session | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<Session | null>(null);

  const refreshSessions = async () => {
    try {
      setSessions(await listActiveSessions());
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  useEffect(() => {
    refreshSessions();
    const t = setInterval(refreshSessions, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { customers, subscribers } = await searchPeople(query.trim());
      const enriched: Hit[] = await Promise.all([
        ...customers.map(async (c) => ({
          kind: "customer" as const,
          c,
          activeSessionId: (await findActiveSessionForPerson({ customer_id: c.id }))?.id,
        })),
        ...subscribers.map(async (s) => ({
          kind: "subscriber" as const,
          s,
          activeSessionId: (await findActiveSessionForPerson({ subscriber_id: s.id }))?.id,
        })),
      ]);
      setHits(enriched);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Group by room for board view
  const board = useMemo(() => {
    const map = new Map<string, { roomName: string; color: string; rows: Session[] }>();
    for (const s of sessions) {
      const key = s.room_id;
      if (!map.has(key))
        map.set(key, {
          roomName: s.room?.name ?? "Room",
          color: s.room?.label_color ?? "#354A37",
          rows: [],
        });
      map.get(key)!.rows.push(s);
    }
    return Array.from(map.entries());
  }, [sessions]);

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-5">
        {/* SEARCH */}
        <div className="mx-auto max-w-2xl">
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" style={{ color: "var(--muted)" }} />
              <input
                className="input !border-0 !shadow-none"
                placeholder="Search name or phone to check in / out…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            {query.trim() && (
              <div className="mt-3 space-y-2">
                {hits.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    No matches. Add this customer from the Customers page.
                  </p>
                )}
                {hits.map((h, i) => {
                  const isSub = h.kind === "subscriber";
                  const name = isSub ? h.s.name : h.c.name;
                  const phone = isSub ? h.s.phone : h.c.phone;
                  const study = isSub ? "—" : h.c.study || "—";
                  return (
                    <div
                      key={i}
                      className="flex flex-wrap items-center gap-3 rounded-xl border p-2.5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{name}</span>
                          {isSub ? (
                            <span className="badge" style={{ background: "var(--brand)", color: "#fff" }}>
                              Subscriber · {h.s.code}
                            </span>
                          ) : (
                            <span className="badge" style={{ background: "var(--border)" }}>
                              Customer
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          {phone} • {study}
                        </div>
                      </div>
                      {h.activeSessionId ? (
                        <button
                          className="btn btn-danger"
                          onClick={() => router.push(`/checkout/${h.activeSessionId}`)}
                        >
                          <LogOut className="h-4 w-4" /> Checkout
                        </button>
                      ) : (
                        <button className="btn btn-primary" onClick={() => setStartFor(h)}>
                          <Play className="h-4 w-4" /> Check in
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ROOM BOARD */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Currently checked in
            </h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {sessions.length} active
            </span>
          </div>

          {!board.length && (
            <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              No active sessions. Check someone in from the search above.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {board.map(([roomId, { roomName, color, rows }]) => (
              <div key={roomId} className="card overflow-hidden">
                <div
                  className="flex items-center justify-between border-b px-4 py-2.5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                    <span className="font-medium">{roomName}</span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {rows.length} active
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {rows.map((s) => {
                    const isSub = !!s.subscriber_id;
                    const name = s.customer?.name ?? s.subscriber?.name ?? "—";
                    const dur = formatDuration(minutesBetween(s.started_at, new Date().toISOString()));
                    return (
                      <div key={s.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{name}</div>
                            <div className="text-xs" style={{ color: "var(--muted)" }}>
                              Since {dt(s.started_at)} · {dur}
                              {isSub && " · Subscriber"}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button className="btn btn-ghost flex-1" onClick={() => setAddOrdersFor(s)}>
                            <Plus className="h-3.5 w-3.5" /> Add orders
                          </button>
                          <button className="btn btn-primary flex-1" onClick={() => setCheckoutFor(s)}>
                            <LogOut className="h-3.5 w-3.5" /> Checkout
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODALS */}
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
          setQuery("");
          refreshSessions();
        }}
      />
      <AddOrdersModal
        open={!!addOrdersFor}
        onClose={() => setAddOrdersFor(null)}
        sessionId={addOrdersFor?.id ?? ""}
        onSaved={() => refreshSessions()}
      />
      <ConfirmDialog
        open={!!checkoutFor}
        title="Confirm checkout"
        message="This will close the session and take you to checkout. This cannot be undone."
        confirmLabel="Continue to checkout"
        destructive
        onCancel={() => setCheckoutFor(null)}
        onConfirm={() => {
          const id = checkoutFor!.id;
          setCheckoutFor(null);
          router.push(`/checkout/${id}`);
        }}
      />
    </>
  );
}
