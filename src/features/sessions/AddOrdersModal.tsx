"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Trash2, TrendingUp } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemCategory } from "@/lib/types";
import { money } from "@/lib/format";

type Line = { item: Item; quantity: number };

const CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: "Drink", label: "Drinks" },
  { key: "Snack", label: "Snacks" },
  { key: "Product", label: "Products" },
  { key: "Service", label: "Services" },
];

type Tab = "all" | ItemCategory;

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
  const [popularity, setPopularity] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    setLines([]);
    setTab("all");
    sb.from("items")
      .select("*")
      .is("deleted_at", null)
      .gt("stock", 0)
      .order("name")
      .then(({ data }) => setItems((data as Item[]) ?? []));

    // Build popularity ranking from past orders (total quantity sold per item)
    sb.from("session_orders")
      .select("item_id, quantity")
      .is("deleted_at", null)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        for (const row of (data as { item_id: string; quantity: number }[]) ?? []) {
          counts[row.item_id] = (counts[row.item_id] ?? 0) + Number(row.quantity);
        }
        setPopularity(counts);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.item.price * l.quantity, 0),
    [lines]
  );

  // Filter by selected category tab, then sort by popularity (most-ordered first),
  // falling back to name for items with equal/zero sales.
  const visibleItems = useMemo(() => {
    const filtered = tab === "all" ? items : items.filter((i) => i.category === tab);
    return [...filtered].sort((a, b) => {
      const pa = popularity[a.id] ?? 0;
      const pb = popularity[b.id] ?? 0;
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });
  }, [items, tab, popularity]);

  // The single most-ordered item across the visible list — flagged as "top choice".
  const topItemId = useMemo(() => {
    let best: string | null = null;
    let bestCount = 0;
    for (const i of visibleItems) {
      const c = popularity[i.id] ?? 0;
      if (c > bestCount) {
        bestCount = c;
        best = i.id;
      }
    }
    return best;
  }, [visibleItems, popularity]);

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

          {/* Category tabs */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <CategoryTab label="All" active={tab === "all"} onClick={() => setTab("all")} />
            {CATEGORIES.map((c) => (
              <CategoryTab
                key={c.key}
                label={c.label}
                active={tab === c.key}
                onClick={() => setTab(c.key)}
              />
            ))}
          </div>

          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {visibleItems.map((i) => {
              const isTop = i.id === topItemId;
              return (
                <button
                  key={i.id}
                  onClick={() => addItem(i)}
                  className="relative rounded-xl border p-3 text-left transition hover:shadow-soft"
                  style={{
                    borderColor: isTop ? "var(--brand)" : "var(--border)",
                    background: isTop ? "rgba(53,74,55,0.04)" : "transparent",
                  }}
                >
                  {isTop && (
                    <span
                      className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--brand)", color: "#fff" }}
                    >
                      <TrendingUp className="h-2.5 w-2.5" /> Top
                    </span>
                  )}
                  <div className="font-medium text-sm pr-10">{i.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {i.category} • Stock {i.stock}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "var(--brand)" }}>
                    {money(i.price)}
                  </div>
                </button>
              );
            })}
            {!visibleItems.length && (
              <p className="text-sm col-span-2" style={{ color: "var(--muted)" }}>
                {items.length ? "No items in this category." : "No items available."}
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

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
      style={{
        borderColor: active ? "var(--brand)" : "var(--border)",
        background: active ? "var(--brand)" : "transparent",
        color: active ? "#fff" : "var(--muted)",
      }}
    >
      {label}
    </button>
  );
}
