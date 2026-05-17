"use client";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createSubscriber, listPlans, updateSubscriber } from "./api";
import type { Plan, Subscriber } from "@/lib/types";
import { money } from "@/lib/format";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";

export function SubscriberFormModal({
  open, onClose, initial, onCreated, onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Subscriber | null;
  onCreated?: (s: Subscriber, invoiceId: string) => void;
  onUpdated?: () => void;
}) {
  const { push } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    listPlans().then((p) => {
      setPlans(p);
      setPlanId(initial?.plan_id ?? p[0]?.id ?? "");
    });
    setName(initial?.name ?? "");
    setPhone(initial?.phone ?? "");
    setPaymentMethod(initial?.payment_method ?? "Cash");
  }, [open, initial]);

  const plan = useMemo(() => plans.find((p) => p.id === planId), [planId, plans]);
  const expiresAt = useMemo(() => {
    if (!plan) return null;
    const d = new Date();
    d.setDate(d.getDate() + plan.expiration_days);
    return d;
  }, [plan]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !plan) {
      push({ kind: "err", msg: "All fields are required" });
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updateSubscriber(initial.id, { name, phone, payment_method: paymentMethod });
        push({ kind: "ok", msg: "Subscriber updated" });
        onUpdated?.();
        onClose();
      } else {
        const { subscriber, invoice } = await createSubscriber({
          name: name.trim(),
          phone: phone.trim(),
          plan,
          payment_method: paymentMethod,
        });
        push({ kind: "ok", msg: `Subscriber created: ${subscriber.code}` });
        onCreated?.(subscriber, invoice.id);
        onClose();
      }
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit subscriber ${initial.code}` : "New subscriber"}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Subscriber name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Phone number</label>
            <input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        {!initial && (
          <div>
            <label className="label">Subscriber plan</label>
            <select
              className="input mt-1"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.letter} • {p.name} — {p.hours}h / {p.expiration_days}d / {money(Number(p.price))}
                </option>
              ))}
            </select>
            {!plans.length && (
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                No plans yet — create one first.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="label mb-2 block">Payment method</label>
          <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
        </div>

        {!initial && plan && (
          <div
            className="rounded-xl border p-3 text-sm"
            style={{ borderColor: "var(--border)", background: "rgba(53,74,55,0.04)" }}
          >
            <div className="label mb-1">Summary</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Cell label="Generated ID" value={`${plan.letter}### (auto)`} />
              <Cell label="Total hours" value={`${plan.hours}h`} />
              <Cell label="Total price" value={money(Number(plan.price))} />
              <Cell label="Expires" value={expiresAt?.toLocaleDateString() ?? "—"} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || (!initial && !plan)}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create & issue invoice"}
          </button>
        </div>
      </form>
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
