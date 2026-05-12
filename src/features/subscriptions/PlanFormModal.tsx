"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createPlan, updatePlan, type PlanInput } from "./api";
import type { Plan } from "@/lib/types";

const PRESET_COLORS = [
  "#354A37", "#000000", "#FAA9A9", "#D0FFB6",
  "#3B6EA8", "#A77BCA", "#E2A55E", "#5E8B7E",
];

export function PlanFormModal({
  open, onClose, initial, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Plan | null;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [letter, setLetter] = useState("Z");
  const [hours, setHours] = useState(20);
  const [price, setPrice] = useState(0);
  const [seats, setSeats] = useState(10);
  const [expDays, setExpDays] = useState(30);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setLetter(initial?.letter ?? "Z");
    setHours(initial?.hours ?? 20);
    setPrice(initial ? Number(initial.price) : 0);
    setSeats(initial?.available_seats ?? 10);
    setExpDays(initial?.expiration_days ?? 30);
    setColor(initial?.label_color ?? PRESET_COLORS[0]);
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !letter.trim()) {
      push({ kind: "err", msg: "Name and letter are required" });
      return;
    }
    setBusy(true);
    try {
      const input: PlanInput = {
        name: name.trim(),
        description: description.trim() || null,
        letter: letter.trim().toUpperCase().slice(0, 3),
        hours,
        price,
        available_seats: seats,
        expiration_days: expDays,
        label_color: color,
      };
      if (initial) await updatePlan(initial.id, input);
      else await createPlan(input);
      push({ kind: "ok", msg: initial ? "Plan updated" : "Plan created" });
      onSaved();
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Failed to save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit plan" : "New plan"} size="lg">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Plan name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Plan letter (Z, N, F…)</label>
            <input
              className="input mt-1 uppercase"
              maxLength={3}
              value={letter}
              onChange={(e) => setLetter(e.target.value.toUpperCase())}
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumField label="Plan hours" value={hours} onChange={setHours} />
          <NumField label="Plan price" value={price} onChange={setPrice} step="0.01" />
          <NumField label="Available seats" value={seats} onChange={setSeats} />
          <NumField label="Expiration (days)" value={expDays} onChange={setExpDays} />
        </div>
        <div>
          <label className="label">Label color</label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2"
                style={{
                  background: c,
                  borderColor: color === c ? "var(--brand)" : "transparent",
                }}
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
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create plan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NumField({
  label, value, onChange, step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min={0}
        step={step ?? "1"}
        className="input mt-1"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </div>
  );
}
