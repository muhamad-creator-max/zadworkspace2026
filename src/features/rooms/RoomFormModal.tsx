"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createRoom, updateRoom, type RoomInput } from "./api";
import type { Room } from "@/lib/types";

const PRESET_COLORS = [
  "#354A37", "#000000", "#FAA9A9", "#D0FFB6",
  "#3B6EA8", "#A77BCA", "#E2A55E", "#5E8B7E",
];

const emptyPrices = () =>
  Array.from({ length: 12 }, (_, i) => ({ hour: i + 1, price: 0 }));

export function RoomFormModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Room | null;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [prices, setPrices] = useState(emptyPrices());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setCapacity(initial?.capacity ?? 1);
    setColor(initial?.label_color ?? PRESET_COLORS[0]);
    const seeded = emptyPrices().map((row) => {
      const found = initial?.hourly_prices?.find((p) => p.hour === row.hour);
      return found ? { hour: row.hour, price: Number(found.price) } : row;
    });
    setPrices(seeded);
  }, [open, initial]);

  const setPriceAt = (hour: number, value: string) => {
    const n = Number(value);
    setPrices((p) =>
      p.map((row) => (row.hour === hour ? { ...row, price: isNaN(n) ? 0 : n } : row))
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      push({ kind: "err", msg: "Room name is required" });
      return;
    }
    setBusy(true);
    try {
      const input: RoomInput = {
        name: name.trim(),
        description: description.trim() || null,
        capacity,
        hourly_prices: prices,
        label_color: color,
      };
      if (initial) await updateRoom(initial.id, input);
      else await createRoom(input);
      push({ kind: "ok", msg: initial ? "Room updated" : "Room added" });
      onSaved();
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Failed to save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit room" : "Add new room"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Room name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Capacity</label>
            <input
              type="number"
              min={1}
              className="input mt-1"
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input mt-1"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Label color</label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2 transition"
                style={{
                  background: c,
                  borderColor: color === c ? "var(--brand)" : "transparent",
                }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-10 rounded border"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </div>

        <div>
          <label className="label">Hourly prices (1–12 hours)</label>
          <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4">
            {prices.map((row) => (
              <div
                key={row.hour}
                className="flex items-center gap-2 rounded-xl border px-2 py-1.5"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  {row.hour}h
                </span>
                <input
                  type="number"
                  min={0}
                  className="input !py-1 !text-sm"
                  value={row.price}
                  onChange={(e) => setPriceAt(row.hour, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add room"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
