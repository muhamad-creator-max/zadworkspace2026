"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Circle,
  Pencil,
  Pin,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useStaffAccess } from "@/lib/hooks/useStaffAccess";
import {
  listMyTasks,
  softDeleteTask,
  toggleAssignmentDone,
} from "@/features/tasks/api";
import { TaskFormModal } from "@/features/tasks/TaskFormModal";
import { TaskStatusBadge } from "@/features/tasks/TaskStatusBadge";
import type { Task, TaskAssignment } from "@/lib/types";
import { dt } from "@/lib/format";

const RTL_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const detectDir = (s: string): "rtl" | "ltr" => (RTL_RE.test(s) ? "rtl" : "ltr");

type TaskWithMine = Task & {
  my_assignment: TaskAssignment | null;
  assignments?: TaskAssignment[];
  creator?: { id: string; name: string; email: string };
};

type Filter = "all" | "pending" | "done" | "scheduled" | "pinned";

const fmtPinTime = (t: string | null): string => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function TasksPage() {
  const { authorized, staff } = useStaffAccess();
  const { push } = useToast();
  const [tasks, setTasks] = useState<TaskWithMine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [editing, setEditing] = useState<TaskWithMine | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await listMyTasks();
      setTasks(list as TaskWithMine[]);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      switch (filter) {
        case "all":
          return true;
        case "pending":
          return !t.my_assignment?.done_at && t.status !== "done";
        case "done":
          return !!t.my_assignment?.done_at || t.status === "done";
        case "scheduled":
          return t.status === "scheduled";
        case "pinned":
          return t.pin_enabled;
      }
    });
  }, [tasks, filter]);

  const toggleDone = async (t: TaskWithMine) => {
    if (!t.my_assignment) {
      push({ kind: "err", msg: "You are not assigned to this task" });
      return;
    }
    try {
      const next = !t.my_assignment.done_at;
      await toggleAssignmentDone(t.my_assignment.id, next);
      push({ kind: "ok", msg: next ? "Marked done" : "Marked not done" });
      refresh();
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await softDeleteTask(deletingId);
      setDeletingId(null);
      push({ kind: "ok", msg: "Task deleted" });
      refresh();
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  if (!authorized) {
    return (
      <>
        <Topbar title="Tasks" />
        <div className="p-5 text-sm" style={{ color: "var(--muted)" }}>
          Checking access…
        </div>
      </>
    );
  }

  const filterOptions: { v: Filter; label: string }[] = [
    { v: "pending", label: "Pending" },
    { v: "done", label: "Done" },
    { v: "scheduled", label: "Scheduled" },
    { v: "pinned", label: "Pinned" },
    { v: "all", label: "All" },
  ];

  return (
    <>
      <Topbar title="Tasks" />
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((opt) => {
              const selected = filter === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFilter(opt.v)}
                  className="badge"
                  style={{
                    background: selected ? "var(--brand)" : "var(--surface)",
                    color: selected ? "#fff" : "var(--text)",
                    border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New task
          </button>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
            Loading tasks…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
            No tasks match this filter.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => {
              const done = !!t.my_assignment?.done_at;
              const isMine = t.created_by === staff?.id;
              const dir = detectDir(t.content);
              const isRTL = dir === "rtl";
              const assignments = t.assignments ?? [];
              const others = assignments.filter((a) => a.assignee_id !== staff?.id);
              const creatorName = isMine ? "You" : t.creator?.name ?? "—";

              // Accent color on left border based on derived status
              const accent = done
                ? "#16A34A"
                : t.status === "scheduled"
                ? "#6366F1"
                : "#F59E0B";

              return (
                <div
                  key={t.id}
                  className="card flex flex-col overflow-hidden transition hover:shadow-soft-lg"
                  style={{ borderLeft: `3px solid ${accent}` }}
                >
                  {/* Header: status + actions */}
                  <div
                    className="flex items-center justify-between px-3.5 pt-3"
                    style={{ minHeight: "2.25rem" }}
                  >
                    <TaskStatusBadge status={t.status} doneByMe={done} />
                    {isMine && (
                      <div className="flex gap-1">
                        <button
                          className="rounded-md p-1.5 transition hover:opacity-70"
                          style={{ color: "var(--muted)" }}
                          onClick={() => {
                            setEditing(t);
                            setModalOpen(true);
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-md p-1.5 transition hover:opacity-70"
                          style={{ color: "var(--muted)" }}
                          onClick={() => setDeletingId(t.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3.5 py-3">
                    <div
                      dir={dir}
                      style={{
                        textAlign: isRTL ? "right" : "left",
                        textDecoration: done ? "line-through" : "none",
                        color: done ? "var(--muted)" : "var(--text)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                      className="text-sm font-medium leading-relaxed"
                    >
                      {t.content}
                    </div>
                  </div>

                  {/* Detail chips */}
                  <div className="space-y-1.5 px-3.5 pb-3">
                    {t.alert_at && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
                        style={{
                          background: "rgba(245, 158, 11, 0.1)",
                          color: "#92400E",
                          border: "1px solid rgba(245, 158, 11, 0.25)",
                        }}
                      >
                        <Bell className="h-3 w-3 shrink-0" />
                        <span className="truncate">{dt(t.alert_at)}</span>
                      </div>
                    )}
                    {t.pin_enabled && t.pin_time && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
                        style={{
                          background: "rgba(53, 74, 55, 0.08)",
                          color: "var(--brand)",
                          border: "1px solid rgba(53, 74, 55, 0.2)",
                        }}
                      >
                        <Pin className="h-3 w-3 shrink-0" />
                        <span className="truncate">Daily at {fmtPinTime(t.pin_time)}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer: meta + done toggle */}
                  <div
                    className="flex items-center justify-between gap-2 border-t px-3.5 py-2.5"
                    style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                  >
                    <div className="min-w-0 space-y-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          By <span style={{ color: "var(--text)" }}>{creatorName}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {others.length > 0 ? (
                          <>
                            <Users className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {assignments.length} assigned ({others.length} other
                              {others.length === 1 ? "" : "s"})
                            </span>
                          </>
                        ) : (
                          <>
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{dt(t.created_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleDone(t)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition shrink-0"
                      style={{
                        background: done ? "var(--brand-success)" : "var(--surface)",
                        color: done ? "#14532D" : "var(--text)",
                        border: `1px solid ${done ? "rgba(22,163,74,0.35)" : "var(--border)"}`,
                      }}
                      title={done ? "Mark not done" : "Mark done"}
                    >
                      {done ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Done
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5" /> Mark done
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        task={editing as any}
      />
      <ConfirmDialog
        open={!!deletingId}
        title="Delete task"
        message="This task will be removed for you and all assignees. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeletingId(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
