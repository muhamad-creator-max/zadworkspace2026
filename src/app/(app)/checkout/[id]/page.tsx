"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock, DoorOpen, User, IdCard, Plus, Trash2, Receipt, ChevronLeft,
  ArrowRightLeft,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { AddOrdersModal } from "@/features/sessions/AddOrdersModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { listRooms, switchRoom } from "@/features/sessions/api";
import {
  checkoutSession, getOrdersForSession, getSession, removeOrder,
} from "@/features/checkout/api";
import type { Room, Session, SessionOrder, SessionSegment } from "@/lib/types";
import { dt, formatDuration, minutesBetween, money } from "@/lib/format";
import { priceForDuration, applyCustomerBuffer } from "@/lib/pricing";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => new Date().toISOString());
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const s = await getSession(params.id);
      setSession(s);
      setOrders(await getOrdersForSession(s.id));
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const calc = useMemo(() => {
    if (!session) return null;
    const isSubscriber = !!session.subscriber_id;
    const closedSegments: SessionSegment[] = session.session_segments ?? [];

    // Current (open) segment starts right after last closed segment
    const currentStart = closedSegments.length > 0
      ? closedSegments[closedSegments.length - 1].ended_at
      : session.started_at;

    const currentMinutes = session.status === "closed"
      ? 0
      : minutesBetween(currentStart, now);
    const currentPrice = isSubscriber ? 0 : priceForDuration(session.room!, currentMinutes);

    // If already closed, use persisted data
    if (session.status === "closed") {
      const allSegs = closedSegments;
      const sessionPrice = Number(session.session_price);
      const ordersAmount = orders.reduce((s, o) => s + Number(o.line_total), 0);
      return {
        closedSegments: allSegs,
        currentSegment: null,
        currentStart,
        currentMinutes: 0,
        currentPrice: 0,
        sessionPrice,
        ordersAmount,
        total: sessionPrice + ordersAmount,
        isSubscriber,
      };
    }

    const closedTotal = closedSegments.reduce((s, seg) => s + seg.price, 0);
    const sessionPrice = closedTotal + currentPrice;
    const ordersAmount = orders.reduce((s, o) => s + Number(o.line_total), 0);

    return {
      closedSegments,
      currentSegment: {
        room_name: session.room?.name ?? "Room",
        started_at: currentStart,
        duration_minutes: currentMinutes,
        price: currentPrice,
      },
      currentStart,
      currentMinutes,
      currentPrice,
      sessionPrice,
      ordersAmount,
      total: sessionPrice + ordersAmount,
      isSubscriber,
    };
  }, [session, orders, now]);

  const doCheckout = async () => {
    setBusy(true);
    try {
      const inv = await checkoutSession({ sessionId: params.id, paymentMethod, note });
      push({ kind: "ok", msg: "Checked out" });
      router.push(`/invoice/${inv.id}`);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (!session || !calc) {
    return (
      <>
        <Topbar title="Checkout" />
        <div className="p-5 text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
      </>
    );
  }

  const personName = session.customer?.name ?? session.subscriber?.name ?? "—";
  const personMeta = session.customer
    ? `${session.customer.phone} • ${session.customer.study ?? "—"}`
    : session.subscriber
    ? `${session.subscriber.phone} • Plan ${session.subscriber.plan?.name ?? ""}`
    : "";

  const hasMultipleRooms = calc.closedSegments.length > 0;

  return (
    <>
      <Topbar title="Checkout" />
      <div className="p-5">
        <button
          className="mb-4 inline-flex items-center gap-1 text-sm"
          style={{ color: "var(--muted)" }}
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          {/* LEFT: Invoice details */}
          <div className="card overflow-hidden">
            <div
              className="flex items-center justify-between border-b px-5 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4" style={{ color: "var(--brand)" }} />
                <span className="font-semibold">Invoice details</span>
                {session.status === "closed" && (
                  <span className="badge ml-2" style={{ background: "#D0FFB6", color: "#1d3a16" }}>
                    Closed
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                {dt(new Date().toISOString())}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 px-5 py-4 md:grid-cols-4">
              <InfoItem icon={<User className="h-3.5 w-3.5" />} label="Customer" value={personName} sub={personMeta} />
              <InfoItem
                icon={<DoorOpen className="h-3.5 w-3.5" />}
                label="Room"
                value={session.room?.name ?? "—"}
                sub={hasMultipleRooms ? `${calc.closedSegments.length + (session.status !== "closed" ? 1 : 0)} rooms total` : undefined}
              />
              <InfoItem
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Duration"
                value={formatDuration(
                  (calc.closedSegments.reduce((s, seg) => s + seg.duration_minutes, 0)) +
                  (session.status === "closed" ? 0 : calc.currentMinutes)
                )}
                sub={`Started ${dt(session.started_at)}`}
              />
              <InfoItem icon={<IdCard className="h-3.5 w-3.5" />} label="Staff" value={session.created_by} />
            </div>

            {/* Room segments breakdown — shown when rooms were switched */}
            {(hasMultipleRooms || session.status === "closed") && (
              <div className="border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
                <p className="label mb-2">Room segments</p>
                <div className="space-y-1.5">
                  {calc.closedSegments.map((seg, i) => (
                    <SegmentRow
                      key={i}
                      index={i + 1}
                      seg={seg}
                      isSubscriber={calc.isSubscriber}
                      closed
                    />
                  ))}
                  {/* Current open segment */}
                  {calc.currentSegment && session.status !== "closed" && (
                    <SegmentRow
                      index={calc.closedSegments.length + 1}
                      seg={{
                        room_id: session.room_id,
                        room_name: calc.currentSegment.room_name,
                        started_at: calc.currentSegment.started_at,
                        ended_at: now,
                        duration_minutes: calc.currentSegment.duration_minutes,
                        price: calc.currentSegment.price,
                      }}
                      isSubscriber={calc.isSubscriber}
                      closed={false}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <table className="table-zad">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Session line(s) */}
                  {calc.isSubscriber ? (
                    <tr>
                      <td>
                        <div className="font-medium">
                          {hasMultipleRooms
                            ? calc.closedSegments.map((s) => s.room_name).concat(
                                session.status !== "closed" ? [calc.currentSegment?.room_name ?? ""] : []
                              ).join(" → ") + " (subscriber)"
                            : `${session.room?.name} session (subscriber)`}
                        </div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          Covered by plan
                        </div>
                      </td>
                      <td className="text-right">1</td>
                      <td className="text-right">{money(0)}</td>
                      <td className="text-right font-medium">{money(0)}</td>
                    </tr>
                  ) : (
                    <>
                      {/* Closed segments */}
                      {calc.closedSegments.map((seg, i) => {
                        const h = applyCustomerBuffer(seg.duration_minutes);
                        const label = h === 0
                          ? `${seg.room_name} (free — under 15 min)`
                          : `${seg.room_name} (${h}h)`;
                        return (
                          <tr key={i}>
                            <td>
                              <div className="font-medium">{label}</div>
                              <div className="text-xs" style={{ color: "var(--muted)" }}>
                                {dt(seg.started_at)} → {dt(seg.ended_at)}
                              </div>
                            </td>
                            <td className="text-right">1</td>
                            <td className="text-right">{money(seg.price)}</td>
                            <td className="text-right font-medium">{money(seg.price)}</td>
                          </tr>
                        );
                      })}
                      {/* Current live segment */}
                      {session.status !== "closed" && (
                        <tr>
                          <td>
                            <div className="font-medium">
                              {calc.currentSegment
                                ? (() => {
                                    const h = applyCustomerBuffer(calc.currentMinutes);
                                    return h === 0
                                      ? `${calc.currentSegment.room_name} (free — under 15 min)`
                                      : `${calc.currentSegment.room_name} (${h}h)`;
                                  })()
                                : `${session.room?.name} session`}
                            </div>
                            <div className="text-xs" style={{ color: "var(--muted)" }}>
                              {dt(calc.currentStart)} → now
                            </div>
                          </td>
                          <td className="text-right">1</td>
                          <td className="text-right">{money(calc.currentPrice)}</td>
                          <td className="text-right font-medium">{money(calc.currentPrice)}</td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* Orders */}
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.item_name}</td>
                      <td className="text-right">{o.quantity}</td>
                      <td className="text-right">{money(Number(o.unit_price))}</td>
                      <td className="text-right">
                        <span className="font-medium">{money(Number(o.line_total))}</span>
                        {session.status !== "closed" && (
                          <button
                            className="btn btn-ghost !px-1.5 !py-1 ml-2"
                            onClick={async () => {
                              try {
                                await removeOrder(o.id);
                                refresh();
                              } catch (e: any) {
                                push({ kind: "err", msg: e.message });
                              }
                            }}
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
                <Row label="Session" value={money(calc.sessionPrice)} />
                <Row label="Orders" value={money(calc.ordersAmount)} />
                <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                <Row label="Total" value={money(calc.total)} bold />
              </div>
            </div>

            {session.status !== "closed" && (
              <div className="border-t" style={{ borderColor: "var(--border)" }}>
                {/* Note for next session */}
                <div className="border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
                  <label className="label mb-1.5 block">Note for next session (optional)</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="e.g. Prefers quiet room, has monthly plan renewal coming up…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    Shown on the dashboard when this person is searched next time.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex-1">
                    <label className="label mb-2 block">Payment method</label>
                    <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => setConfirmCheckout(true)}
                    disabled={busy}
                  >
                    Checkout • {money(calc.total)}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Actions */}
          <div className="space-y-4">
            {/* Switch room */}
            {session.status !== "closed" && (
              <div className="card overflow-hidden h-fit">
                <div
                  className="flex items-center gap-2 border-b px-5 py-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <ArrowRightLeft className="h-4 w-4" style={{ color: "var(--brand)" }} />
                  <span className="font-semibold">Switch room</span>
                </div>
                <div className="p-5">
                  <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
                    Move this customer to a different room. Time and price in the current room will be saved as a separate segment.
                  </p>
                  <button
                    className="btn btn-ghost w-full"
                    onClick={() => setSwitchOpen(true)}
                  >
                    <ArrowRightLeft className="h-4 w-4" /> Switch room
                  </button>
                </div>
              </div>
            )}

            {/* Add orders */}
            <div className="card overflow-hidden h-fit">
              <div
                className="flex items-center justify-between border-b px-5 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="font-semibold">Add orders</span>
                {session.status === "closed" && (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    Closed — read-only
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
                  Add items from inventory to this invoice before checkout.
                </p>
                <button
                  className="btn btn-primary w-full"
                  onClick={() => setAddOpen(true)}
                  disabled={session.status === "closed"}
                >
                  <Plus className="h-4 w-4" /> Add items to invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddOrdersModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sessionId={session.id}
        onSaved={refresh}
      />

      <SwitchRoomModal
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        session={session}
        onSwitched={async () => {
          setSwitchOpen(false);
          await refresh();
          push({ kind: "ok", msg: "Room switched — new segment started" });
        }}
      />

      <ConfirmDialog
        open={confirmCheckout}
        title="Confirm checkout"
        message="This closes the session and creates the invoice. This cannot be undone."
        confirmLabel="Checkout"
        onCancel={() => setConfirmCheckout(false)}
        onConfirm={() => {
          setConfirmCheckout(false);
          doCheckout();
        }}
      />
    </>
  );
}

// ── Switch Room Modal ─────────────────────────────────────────────────────────

function SwitchRoomModal({
  open, onClose, session, onSwitched,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  onSwitched: () => void;
}) {
  const { push } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    listRooms().then((r) => {
      // Exclude the room they're already in
      const available = r.filter((rm) => rm.id !== session.room_id);
      setRooms(available);
      setRoomId(available[0]?.id ?? "");
    });
  }, [open, session.room_id]);

  const submit = async () => {
    if (!roomId) return;
    setBusy(true);
    try {
      await switchRoom(session.id, roomId);
      onSwitched();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Could not switch room" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Switch room">
      <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
        Currently in <strong>{session.room?.name}</strong>. Select the new room:
      </p>
      <div className="space-y-2">
        {rooms.map((r) => (
          <label
            key={r.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition"
            style={{
              borderColor: roomId === r.id ? "var(--brand)" : "var(--border)",
              background: roomId === r.id ? "rgba(53,74,55,0.06)" : "transparent",
            }}
          >
            <input
              type="radio"
              checked={roomId === r.id}
              onChange={() => setRoomId(r.id)}
              className="accent-[#354A37]"
            />
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: r.label_color }} />
            <span className="font-medium">{r.name}</span>
            <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>Capacity {r.capacity}</span>
          </label>
        ))}
        {!rooms.length && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>No other rooms available.</p>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !roomId}>
          {busy ? "Switching…" : "Switch room"}
        </button>
      </div>
    </Modal>
  );
}

// ── Segment row ───────────────────────────────────────────────────────────────

function SegmentRow({
  index, seg, isSubscriber, closed,
}: {
  index: number;
  seg: SessionSegment;
  isSubscriber: boolean;
  closed: boolean;
}) {
  const dur = formatDuration(seg.duration_minutes);
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
      style={{
        background: closed ? "var(--bg)" : "rgba(53,74,55,0.06)",
        border: `1px solid ${closed ? "var(--border)" : "var(--brand)"}`,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="shrink-0 font-mono text-[10px] w-5 text-center rounded-full py-0.5"
          style={{ background: "var(--border)", color: "var(--muted)" }}
        >
          {index}
        </span>
        <div className="min-w-0">
          <div className="font-medium truncate">{seg.room_name}</div>
          <div style={{ color: "var(--muted)" }}>
            {dt(seg.started_at)} → {closed ? dt(seg.ended_at) : "now"} · {dur}
          </div>
        </div>
      </div>
      <div className="shrink-0 ml-3 font-semibold" style={{ color: closed ? "var(--text)" : "var(--brand)" }}>
        {isSubscriber ? "—" : money(seg.price)}
        {!closed && <span className="ml-1 text-[9px] font-normal" style={{ color: "var(--brand)" }}>live</span>}
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoItem({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="label flex items-center gap-1">{icon} {label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
      {sub && <div className="text-xs" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className={bold ? "text-base font-semibold" : ""}>{value}</span>
    </div>
  );
}
