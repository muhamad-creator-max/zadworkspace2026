"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { PasswordConfirmDialog } from "@/components/ui/PasswordConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { RoomFormModal } from "@/features/rooms/RoomFormModal";
import { listRooms, softDeleteRoom } from "@/features/rooms/api";
import type { Room } from "@/lib/types";
import { money } from "@/lib/format";

export default function RoomsPage() {
  const { push } = useToast();
  const isAdmin = useAdminGuard();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  const refresh = async () => {
    try {
      setRooms(await listRooms());
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Topbar title="Rooms" />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            {rooms.length} rooms
          </h2>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add room
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              isAdmin={isAdmin}
              onEdit={() => setEditTarget(r)}
              onDelete={() => {
                if (!isAdmin) {
                  push({ kind: "err", msg: "Only an Admin can delete records." });
                  return;
                }
                setDeleteTarget(r);
              }}
            />
          ))}
          {!rooms.length && (
            <div className="card col-span-full p-10 text-center text-sm" style={{ color: "var(--muted)" }}>
              No rooms yet. Click <b>Add room</b> to create one.
            </div>
          )}
        </div>
      </div>

      <RoomFormModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <RoomFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        initial={editTarget}
        onSaved={refresh}
      />
      <PasswordConfirmDialog
        open={!!deleteTarget}
        title="Remove room?"
        message={`"${deleteTarget?.name}" will be hidden from new sessions. Past sessions stay intact.`}
        confirmLabel="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirmed={async () => {
          await softDeleteRoom(deleteTarget!.id);
          push({ kind: "ok", msg: "Room removed" });
          setDeleteTarget(null);
          refresh();
        }}
      />
    </>
  );
}

function RoomCard({
  room, isAdmin, onEdit, onDelete,
}: {
  room: Room;
  isAdmin: boolean | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: room.label_color, color: "#fff" }}
      >
        <div>
          <div className="font-semibold">{room.name}</div>
          <div className="text-xs opacity-80 flex items-center gap-1">
            <Users className="h-3 w-3" /> Capacity {room.capacity}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            className="rounded-lg bg-white/15 p-1.5 hover:bg-white/25"
            onClick={onEdit}
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded-lg bg-white/15 p-1.5 hover:bg-white/25"
            onClick={onDelete}
            disabled={isAdmin === null}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {room.description && (
          <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
            {room.description}
          </p>
        )}
        <div className="label mb-2">Hourly pricing</div>
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {room.hourly_prices?.map((p) => (
            <div
              key={p.hour}
              className="rounded-lg border px-2 py-1.5 text-center"
              style={{ borderColor: "var(--border)" }}
            >
              <div style={{ color: "var(--muted)" }}>{p.hour}h</div>
              <div className="font-medium">{money(Number(p.price))}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
