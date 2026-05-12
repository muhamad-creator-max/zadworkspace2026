"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { restockItem } from "./api";
import type { Item } from "@/lib/types";

export function RestockModal({
  open,
  onClose,
  item,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  item: Item | null;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setQty(1);
  }, [open]);

  const submit = async () => {
    if (!item) return;
    if (qty <= 0) {
      push({ kind: "err", msg: "Quantity must be positive" });
      return;
    }
    setBusy(true);
    try {
      await restockItem(item, qty);
      push({ kind: "ok", msg: `Added ${qty} to ${item.name}` });
      onSaved();
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Failed to restock" });
    } finally {
      setBusy(false);
    }
  };

  if (!item) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Restock — ${item.name}`} size="sm">
      <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
        Current stock: <b style={{ color: "var(--text)" }}>{item.stock}</b>
      </p>
      <label className="label">Quantity to add</label>
      <input
        type="number"
        min={1}
        className="input mt-1"
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        autoFocus
      />
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Restock"}
        </button>
      </div>
    </Modal>
  );
}
