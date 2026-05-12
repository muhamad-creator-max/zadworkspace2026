"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/types";
import { money } from "@/lib/format";

type Line = { item: Item; quantity: number };

export function AddOrdersModal({
  open,
  onClose,
  sessionId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSaved?: () => void;
}) {
  const sb = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    setLines([]);
    sb.from("items")
      .select("*")
      .is("deleted_at", null)
      .gt("stock", 0)
      .order("name")
      .then(({ data }) => setItems((data as Item[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.item.price * l.quantity, 0),
    [lines]
  );

  const addItem = (i: Item) => {
    setLines((prev) => {
      const ex = prev.find((l) => l.item.id === i.id);
      if (ex) {
        return prev.map((l) =>
          l.item.id === i.id
            ? { ...l, quantity: Math.min(l.quantity + 1, i.stock) }
            : l
        );
      }
      return [...prev, { item: i, quantity: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.item.id === id ? { ...l, quantity: qty } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const save = async () => {
    if (!lines.length) return;
    setBusy(true);
    try {
      const rows = lines.map((l) => ({
        session_id: sessionId,
        item_id: l.item.id,
        item_name: l.item.name,
        unit_price: l.item.price,
        quantity: l.quantity,
        line_total: l.item.price * l.quantity,
      }));
      const { error } = await sb.from("session_orders").insert(rows);
      if (error) throw error;
      // Decrement stock
      for (const l of lines) {
        await sb
          .from("items")
          .update({ stock: l.item.stock - l.quantity })
          .eq("id", l.item.id);
        await sb.from("stock_movements").insert({
          item_id: l.item.id,
          quantity: -l.quantity,
          reason: `session:${sessionId}`,
        });
      }
      push({ kind: "ok", msg: "Orders added" });
      onSaved?.();
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add orders" size="lg">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="label mb-2">Items in stock</div>
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {items.map((i) => (
              <button
                key={i.id}
                onClick={() => addItem(i)}
                className="rounded-xl border p-3 text-left transition hover:shadow-soft"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="font-medium text-sm">{i.name}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {i.category} • Stock {i.stock}
                </div>
                <div className="mt-1 text-sm" style={{ color: "var(--brand)" }}>
                  {money(i.price)}
                </div>
              </button>
            ))}
            {!items.length && (
              <p className="text-sm col-span-2" style={{ color: "var(--muted)" }}>
                No items available.
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="label mb-2">Selected</div>
          <div className="space-y-2">
            {lines.map((l) => (
              <div
                key={l.item.id}
                className="flex items-center gap-2 rounded-xl border p-2"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{l.item.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {money(l.item.price)} each
                  </div>
                </div>
                <button
                  className="btn btn-ghost !px-2 !py-1"
                  onClick={() => setQty(l.item.id, l.quantity - 1)}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm">{l.quantity}</span>
                <button
                  className="btn btn-ghost !px-2 !py-1"
                  onClick={() =>
                    setQty(l.item.id, Math.min(l.quantity + 1, l.item.stock))
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  className="btn btn-ghost !px-2 !py-1 ml-1"
                  onClick={() => setQty(l.item.id, 0)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!lines.length && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Tap items on the left to add them.
              </p>
            )}
          </div>
          <div
            className="mt-4 flex items-center justify-between border-t pt-3"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="label">Subtotal</span>
            <span className="text-base font-semibold">{money(total)}</span>
          </div>
          <button
            className="btn btn-primary mt-3 w-full"
            onClick={save}
            disabled={busy || !lines.length}
          >
            {busy ? "Saving…" : "Add to invoice"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
