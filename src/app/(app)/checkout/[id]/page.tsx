"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock, DoorOpen, User, IdCard, Plus, Trash2, Receipt, ChevronLeft,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { AddOrdersModal } from "@/features/sessions/AddOrdersModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  checkoutSession, getOrdersForSession, getSession, removeOrder,
} from "@/features/checkout/api";
import type { Session, SessionOrder } from "@/lib/types";
import { dt, formatDuration, minutesBetween, money } from "@/lib/format";
import { priceForDuration } from "@/lib/pricing";

const METHODS = ["Cash", "Card", "Mobile Wallet", "Instapay"];

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
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
    const endIso = session.ended_at ?? now;
    const minutes = session.duration_minutes ?? minutesBetween(session.started_at, endIso);
    const isSubscriber = !!session.subscriber_id;
    const sessionPrice = session.status === "closed"
      ? Number(session.session_price)
      : isSubscriber ? 0 : priceForDuration(session.room!, minutes);
    const ordersAmount = orders.reduce((s, o) => s + Number(o.line_total), 0);
    return {
      endIso,
      minutes,
      sessionPrice,
      ordersAmount,
      total: sessionPrice + ordersAmount,
      isSubscriber,
    };
  }, [session, orders, now]);

  const doCheckout = async () => {
    setBusy(true);
    try {
      const inv = await checkoutSession({ sessionId: params.id, paymentMethod });
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
              <InfoItem icon={<DoorOpen className="h-3.5 w-3.5" />} label="Room" value={session.room?.name ?? "—"} />
              <InfoItem icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={formatDuration(calc.minutes)} sub={`${dt(session.started_at)} → ${dt(calc.endIso)}`} />
              <InfoItem icon={<IdCard className="h-3.5 w-3.5" />} label="Staff" value="admin" />
            </div>

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
                  <tr>
                    <td>
                      <div className="font-medium">{session.room?.name} session</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {calc.isSubscriber ? "Subscriber — covered by plan" : `${Math.max(1, Math.ceil(calc.minutes / 60))}h`}
                      </div>
                    </td>
                    <td className="text-right">1</td>
                    <td className="text-right">{money(calc.sessionPrice)}</td>
                    <td className="text-right font-medium">{money(calc.sessionPrice)}</td>
                  </tr>
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
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <label className="label">Payment method</label>
                  <select
                    className="input mt-1 w-40"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setConfirmCheckout(true)}
                  disabled={busy}
                >
                  Checkout • {money(calc.total)}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Add orders */}
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

      <AddOrdersModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sessionId={session.id}
        onSaved={refresh}
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
