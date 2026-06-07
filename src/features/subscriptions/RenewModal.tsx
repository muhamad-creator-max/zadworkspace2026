"use client";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { listPlans, listSubscriberInvoices, renewSubscriber } from "./api";
import type { Invoice, Plan, Subscriber } from "@/lib/types";
import { money, dt } from "@/lib/format";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { RefreshCw, ArrowLeftRight } from "lucide-react";

type RenewMode = "same" | "switch";

export function RenewModal({
  open,
  onClose,
  subscriber,
  onRenewed,
}: {
  open: boolean;
  onClose: () => void;
  subscriber: Subscriber;
  onRenewed: (invoiceId: string) => void;
}) {
  const { push } = useToast();
  const [mode, setMode] = useState<RenewMode>("same");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [switchPlanId, setSwitchPlanId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("same");
    setPaymentMethod(subscriber.payment_method ?? "Cash");
    Promise.all([
      listPlans(),
      listSubscriberInvoices(subscriber.id),
    ]).then(([p, inv]) => {
      setPlans(p);
      setInvoices(inv);
      const firstOther = p.find((x) => x.id !== subscriber.plan_id);
      setSwitchPlanId(firstOther?.id ?? p[0]?.id ?? "");
    });
  }, [open, subscriber]);

  const currentPlan = subscriber.plan;
  const switchPlan = useMemo(() => plans.find((p) => p.id === switchPlanId), [switchPlanId, plans]);
  const activePlan = mode === "same" ? currentPlan : switchPlan;

  const newExpiresAt = useMemo(() => {
    if (!activePlan) return null;
    const d = new Date();
    d.setDate(d.getDate() + activePlan.expiration_days);
    return d;
  }, [activePlan]);

  const submit = async () => {
    if (!activePlan) return;
    setBusy(true);
    try {
      const result = await renewSubscriber(
        mode === "same"
          ? { mode: "same", subscriberId: subscriber.id, payment_method: paymentMethod }
          : { mode: "switch", subscriberId: subscriber.id, plan: activePlan, payment_method: paymentMethod }
      );
      push({ kind: "ok", msg: `Renewed: ${subscriber.code}` });
      onRenewed(result.invoice.id);
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Renewal failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Renew subscription — ${subscriber.code}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Mode tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{
              borderColor: mode === "same" ? "var(--brand)" : "var(--border)",
              background: mode === "same" ? "rgba(53,74,55,0.08)" : "transparent",
              color: mode === "same" ? "var(--brand)" : "var(--muted)",
              boxShadow: mode === "same" ? "0 0 0 1.5px var(--brand)" : "none",
            }}
            onClick={() => setMode("same")}
          >
            <RefreshCw className="h-4 w-4" />
            Renew same plan
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{
              borderColor: mode === "switch" ? "var(--brand)" : "var(--border)",
              background: mode === "switch" ? "rgba(53,74,55,0.08)" : "transparent",
              color: mode === "switch" ? "var(--brand)" : "var(--muted)",
              boxShadow: mode === "switch" ? "0 0 0 1.5px var(--brand)" : "none",
            }}
            onClick={() => setMode("switch")}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch plan
          </button>
        </div>

        {/* Past invoices */}
        {invoices.length > 0 && (
          <div>
            <div className="label mb-1.5">Past invoices</div>
            <div className="space-y-1 max-h-36 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--muted)" }}>{dt(inv.issued_at)}</span>
                  <span className="font-medium">{money(inv.total_amount)}</span>
                  <span
                    className="badge"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                  >
                    {inv.payment_method}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Switch plan selector */}
        {mode === "switch" && (
          <div>
            <label className="label">Select new plan</label>
            <select
              className="input mt-1"
              value={switchPlanId}
              onChange={(e) => setSwitchPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.letter} • {p.name} — {p.hours}h / {p.expiration_days}d / {money(Number(p.price))}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Payment method */}
        <div>
          <label className="label mb-2 block">Payment method</label>
          <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
        </div>

        {/* Summary */}
        {activePlan && (
          <div
            className="rounded-xl border p-3 text-sm"
            style={{ borderColor: "var(--border)", background: "rgba(53,74,55,0.04)" }}
          >
            <div className="label mb-1">Renewal summary</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Cell label="Plan" value={activePlan.name} />
              <Cell label="Hours" value={`${activePlan.hours}h`} />
              <Cell label="Price" value={money(Number(activePlan.price))} />
              <Cell label="New expiry" value={newExpiresAt?.toLocaleDateString() ?? "—"} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={busy || !activePlan}
            onClick={submit}
          >
            {busy ? "Processing…" : "Confirm renewal & issue invoice"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
