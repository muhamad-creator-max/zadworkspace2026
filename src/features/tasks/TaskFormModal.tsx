"use client";
import { useEffect, useMemo, useState } from "react";
import { Bell, Pin, Users, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createTask, updateTask, listAssignableStaff } from "./api";
import { getCurrentStaffMember } from "@/features/staff/api";
import type { StaffMember, Task, TaskAssignment, TaskStatus } from "@/lib/types";

// Detects Arabic characters anywhere in the string so we can flip dir=rtl.
const RTL_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const detectDir = (s: string): "rtl" | "ltr" => (RTL_RE.test(s) ? "rtl" : "ltr");

// Convert ISO -> "YYYY-MM-DDTHH:MM" for <input type="datetime-local">
const isoToLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const localInputToISO = (val: string): string | null => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// time -> "HH:MM"
const timeForInput = (val: string | null): string => {
  if (!val) return "";
  // Accept "HH:MM" or "HH:MM:SS"
  const parts = val.split(":");
  return `${parts[0]}:${parts[1] ?? "00"}`;
};

export function TaskFormModal({
  open,
  onClose,
  onSaved,
  task,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  task?: (Task & { assignments?: TaskAssignment[] }) | null;
}) {
  const { push } = useToast();
  const isEdit = !!task;

  const [content, setContent] = useState("");
  const [status, setStatus] = useState<TaskStatus>("not_done");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertAt, setAlertAt] = useState<string>("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinTime, setPinTime] = useState<string>("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [list, current] = await Promise.all([
          listAssignableStaff(),
          getCurrentStaffMember(),
        ]);
        setStaff(list);
        setMe(current);

        if (task) {
          setContent(task.content);
          setStatus(task.status);
          setAlertEnabled(!!task.alert_at);
          setAlertAt(isoToLocalInput(task.alert_at));
          setPinEnabled(task.pin_enabled);
          setPinTime(timeForInput(task.pin_time));
          setAssigneeIds(
            (task.assignments ?? []).map((a) => a.assignee_id)
          );
        } else {
          setContent("");
          setStatus("not_done");
          setAlertEnabled(false);
          setAlertAt("");
          setPinEnabled(false);
          setPinTime("");
          setAssigneeIds(current ? [current.id] : []);
        }
      } catch (e: any) {
        push({ kind: "err", msg: e.message });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const dir = useMemo(() => detectDir(content), [content]);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (!content.trim()) {
      push({ kind: "err", msg: "Task content is required" });
      return;
    }
    if (alertEnabled && !alertAt) {
      push({ kind: "err", msg: "Pick an alert date & time" });
      return;
    }
    if (pinEnabled && !pinTime) {
      push({ kind: "err", msg: "Pick a daily pin time" });
      return;
    }
    if (status === "scheduled" && !alertEnabled && !pinEnabled) {
      push({ kind: "err", msg: "Scheduled tasks need an alert date & time or a daily pin" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        content: content.trim(),
        status,
        alert_at: alertEnabled ? localInputToISO(alertAt) : null,
        pin_enabled: pinEnabled,
        pin_time: pinEnabled ? `${pinTime}:00` : null,
        assignee_ids: assigneeIds,
      };
      if (isEdit && task) {
        await updateTask(task.id, payload);
        push({ kind: "ok", msg: "Task updated" });
      } else {
        await createTask(payload);
        push({ kind: "ok", msg: "Task created" });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit task" : "New task"} size="lg">
      <div className="space-y-4">
        {/* Content */}
        <div>
          <label className="label">Task content</label>
          <textarea
            className="input mt-1 min-h-[88px] resize-y"
            placeholder="What needs to be done?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            dir={dir}
            style={{ textAlign: dir === "rtl" ? "right" : "left" }}
            autoFocus
          />
        </div>

        {/* Assignees */}
        <div>
          <label className="label flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Assign to
          </label>
          <div
            className="mt-1 flex flex-wrap gap-2 rounded-xl p-2"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            {staff.map((s) => {
              const selected = assigneeIds.includes(s.id);
              const isMe = me?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleAssignee(s.id)}
                  className="badge"
                  style={{
                    background: selected ? "var(--brand)" : "var(--bg)",
                    color: selected ? "#fff" : "var(--text)",
                    border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                    cursor: "pointer",
                  }}
                >
                  {s.name}
                  {isMe && (
                    <span className="ml-1" style={{ opacity: 0.7 }}>
                      (you)
                    </span>
                  )}
                  {selected && <X className="ml-1 h-3 w-3" />}
                </button>
              );
            })}
            {staff.length === 0 && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                No staff available.
              </span>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Selected members will see this task on their Tasks page and dashboard.
          </p>
        </div>

        {/* Status */}
        <div>
          <label className="label">Status</label>
          <div className="mt-1 flex gap-2">
            {(
              [
                { v: "not_done", label: "Not done" },
                { v: "done", label: "Done" },
                { v: "scheduled", label: "Scheduled" },
              ] as { v: TaskStatus; label: string }[]
            ).map((opt) => {
              const selected = status === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setStatus(opt.v)}
                  className="badge"
                  style={{
                    background: selected ? "var(--brand)" : "var(--bg)",
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
        </div>

        {/* Alert */}
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alertEnabled}
              onChange={(e) => setAlertEnabled(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Bell className="h-4 w-4" style={{ color: "var(--muted)" }} />
            <span className="text-sm font-medium">Alert at a specific date & time</span>
          </label>
          {alertEnabled && (
            <input
              type="datetime-local"
              className="input mt-2"
              value={alertAt}
              onChange={(e) => setAlertAt(e.target.value)}
            />
          )}
        </div>

        {/* Pin */}
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pinEnabled}
              onChange={(e) => setPinEnabled(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Pin className="h-4 w-4" style={{ color: "var(--muted)" }} />
            <span className="text-sm font-medium">Pin daily at a specific time</span>
          </label>
          {pinEnabled && (
            <>
              <input
                type="time"
                className="input mt-2"
                value={pinTime}
                onChange={(e) => setPinTime(e.target.value)}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Will appear in each selected member&apos;s dashboard every day at this time
                until they mark it done.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
