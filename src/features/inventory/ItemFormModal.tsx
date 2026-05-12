"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { CATEGORIES, createItem, updateItem, type ItemInput } from "./api";
import type { Item, ItemCategory } from "@/lib/types";

export function ItemFormModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Item | null;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState<ItemCategory>("Snack");
  const [stock, setStock] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setPrice(initial ? Number(initial.price) : 0);
    setCategory(initial?.category ?? "Snack");
    setStock(initial ? Number(initial.stock) : 0);
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      push({ kind: "err", msg: "Item name is required" });
      return;
    }
    setBusy(true);
    try {
      const input: ItemInput = { name: name.trim(), price, category, stock };
      if (initial) {
        // Don't overwrite stock on edit — restock has its own flow
        await updateItem(initial.id, {
          name: input.name,
          price: input.price,
          category: input.category,
        });
      } else {
        await createItem(input);
      }
      push({ kind: "ok", msg: initial ? "Item updated" : "Item added" });
      onSaved();
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Failed to save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit item" : "Add new item"}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Item name</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input mt-1"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        {!initial && (
          <div>
            <label className="label">Current stock</label>
            <input
              type="number"
              min={0}
              className="input mt-1"
              value={stock}
              onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Use the <b>Restock</b> action later to add more to stock.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
