"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";

export type FinanceKind = "expense" | "income";

export interface FinanceFormValues {
  name: string;
  reason: string;
  amount: number;
  payment_method: string;
  payment_due: string; // ISO datetime
}

function toLocalDatetimeValue(d: Date) {
  // yyyy-MM-ddTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FinanceFormModal({
  open,
  kind,
  onClose,
  onSubmit,
}: {
  open: boolean;
  kind: FinanceKind;
  onClose: () => void;
  onSubmit: (v: FinanceFormValues) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState("Cash");
  const [paymentDue, setPaymentDue] = useState(toLocalDatetimeValue(new Date()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setReason("");
      setAmount("");
      setMethod("Cash");
      setPaymentDue(toLocalDatetimeValue(new Date()));
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    const amt = Number(amount);
    if (!name.trim()) return setErr("Name is required");
    if (!amt || amt <= 0) return setErr("Amount must be greater than 0");
    if (!paymentDue) return setErr("Payment date/time is required");
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        name: name.trim(),
        reason: reason.trim(),
        amount: amt,
        payment_method: method,
        payment_due: new Date(paymentDue).toISOString(),
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const title = kind === "expense" ? "Add Expense" : "Add Income";
  const nameLabel = kind === "expense" ? "Expense Name" : "Income Name";

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-3">
        <div>
          <label className="label">{nameLabel}</label>
          <input
            className="input mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "expense" ? "e.g. Electricity bill" : "e.g. Workshop revenue"}
          />
        </div>
        <div>
          <label className="label">Reason</label>
          <textarea
            className="input mt-1"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being recorded?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (EGP)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">Payment Due (Date &amp; Time)</label>
            <input
              type="datetime-local"
              className="input mt-1"
              value={paymentDue}
              onChange={(e) => setPaymentDue(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Payment Method</label>
          <div className="mt-1">
            <PaymentMethodPicker value={method} onChange={setMethod} />
          </div>
        </div>
        {err && (
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: "var(--brand-danger)", color: "#5a1414" }}
          >
            {err}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
