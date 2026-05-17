"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, PackagePlus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { PasswordConfirmDialog } from "@/components/ui/PasswordConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { ItemFormModal } from "@/features/inventory/ItemFormModal";
import { RestockModal } from "@/features/inventory/RestockModal";
import { CATEGORIES, listItems, softDeleteItem } from "@/features/inventory/api";
import type { Item, ItemCategory } from "@/lib/types";
import { money } from "@/lib/format";

const CATEGORY_COLORS: Record<ItemCategory, string> = {
  Snack: "#E2A55E",
  Drink: "#3B6EA8",
  Product: "#354A37",
  Service: "#A77BCA",
};

export default function InventoryPage() {
  const { push } = useToast();
  const isAdmin = useAdminGuard();
  const [items, setItems] = useState<Item[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [restockTarget, setRestockTarget] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const refresh = async () => {
    try {
      setItems(await listItems());
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const g: Record<ItemCategory, Item[]> = {
      Snack: [], Drink: [], Product: [], Service: [],
    };
    for (const i of items) g[i.category].push(i);
    return g;
  }, [items]);

  const requestDelete = (item: Item) => {
    if (!isAdmin) {
      push({ kind: "err", msg: "Only an Admin can delete records." });
      return;
    }
    setDeleteTarget(item);
  };

  return (
    <>
      <Topbar title="Inventory" />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            {items.length} items
          </h2>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add item
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="card overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ background: CATEGORY_COLORS[cat], color: "#fff" }}
              >
                <span className="font-medium">{cat}</span>
                <span className="text-xs opacity-80">{grouped[cat].length}</span>
              </div>
              <div className="space-y-2 p-3">
                {grouped[cat].map((i) => (
                  <ItemCard
                    key={i.id}
                    item={i}
                    onEdit={() => setEditTarget(i)}
                    onDelete={() => requestDelete(i)}
                    onRestock={() => setRestockTarget(i)}
                  />
                ))}
                {!grouped[cat].length && (
                  <p className="px-1 py-2 text-xs" style={{ color: "var(--muted)" }}>
                    Empty
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ItemFormModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <ItemFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        initial={editTarget}
        onSaved={refresh}
      />
      <RestockModal
        open={!!restockTarget}
        onClose={() => setRestockTarget(null)}
        item={restockTarget}
        onSaved={refresh}
      />
      <PasswordConfirmDialog
        open={!!deleteTarget}
        title="Remove item?"
        message={`"${deleteTarget?.name}" will be hidden from inventory. Past orders remain intact.`}
        confirmLabel="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirmed={async () => {
          await softDeleteItem(deleteTarget!.id);
          push({ kind: "ok", msg: "Item removed" });
          setDeleteTarget(null);
          refresh();
        }}
      />
    </>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
  onRestock,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
  onRestock: () => void;
}) {
  const lowStock = item.stock <= 5;
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-sm" style={{ color: "var(--brand)" }}>
            {money(Number(item.price))}
          </div>
        </div>
        <span
          className="badge"
          style={{
            background: lowStock ? "#FAA9A9" : "#D0FFB6",
            color: lowStock ? "#5a1414" : "#1d3a16",
          }}
        >
          Stock {item.stock}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        <button className="btn btn-ghost !px-2 !py-1 flex-1" onClick={onRestock}>
          <PackagePlus className="h-3.5 w-3.5" /> Restock
        </button>
        <button className="btn btn-ghost !px-2 !py-1" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button className="btn btn-ghost !px-2 !py-1" onClick={onDelete} aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
