"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { listRooms, startSession } from "./api";
import type { Room, Session } from "@/lib/types";

export function StartSessionModal({
  open,
  onClose,
  customerId,
  subscriberId,
  personLabel,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  subscriberId?: string;
  personLabel: string;
  onStarted?: (s: Session) => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    listRooms().then((r) => {
      setRooms(r);
      setRoomId(r[0]?.id ?? "");
    });
  }, [open]);

  const submit = async () => {
    if (!roomId) return;
    setBusy(true);
    try {
      const s = await startSession({
        room_id: roomId,
        customer_id: customerId,
        subscriber_id: subscriberId,
      });
      push({ kind: "ok", msg: "Session started" });
      onStarted?.(s);
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message ?? "Could not start session" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Start session — ${personLabel}`}>
      <label className="label">Select room</label>
      <div className="mt-2 grid gap-2">
        {rooms.map((r) => (
          <label
            key={r.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition"
            style={{
              borderColor: roomId === r.id ? "var(--brand)" : "var(--border)",
              background: roomId === r.id ? "rgba(53,74,55,0.06)" : "transparent",
            }}
          >
            <input
              type="radio"
              checked={roomId === r.id}
              onChange={() => setRoomId(r.id)}
              className="accent-[#354A37]"
            />
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: r.label_color }}
            />
            <span className="font-medium">{r.name}</span>
            <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
              Capacity {r.capacity}
            </span>
          </label>
        ))}
        {!rooms.length && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No rooms yet — add a room first.
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !roomId}>
          {busy ? "Starting…" : "Start session"}
        </button>
      </div>
    </Modal>
  );
}
