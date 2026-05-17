"use client";
import type { TaskStatus } from "@/lib/types";

// Effective status takes into account the current user's done state.
// For dashboard: status is always derived as "not_done" (otherwise it wouldn't show).
// For Tasks page: pass the explicit derived status.
type Variant = "not_done" | "done" | "scheduled";

const VARIANTS: Record<
  Variant,
  { label: string; dot: string; bg: string; fg: string; border: string }
> = {
  not_done: {
    label: "Not done",
    dot: "#F59E0B", // amber
    bg: "rgba(245, 158, 11, 0.12)",
    fg: "#92400E",
    border: "rgba(245, 158, 11, 0.35)",
  },
  done: {
    label: "Done",
    dot: "#16A34A", // green
    bg: "rgba(22, 163, 74, 0.12)",
    fg: "#14532D",
    border: "rgba(22, 163, 74, 0.35)",
  },
  scheduled: {
    label: "Scheduled",
    dot: "#6366F1", // indigo
    bg: "rgba(99, 102, 241, 0.12)",
    fg: "#3730A3",
    border: "rgba(99, 102, 241, 0.35)",
  },
};

export function TaskStatusBadge({
  status,
  doneByMe,
  size = "md",
}: {
  status: TaskStatus;
  doneByMe?: boolean;
  size?: "sm" | "md";
}) {
  // If the current user has personally completed their assignment, show Done
  // regardless of the master status (per the per-assignee model).
  const v: Variant = doneByMe ? "done" : (status as Variant);
  const cfg = VARIANTS[v];
  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${padding}`}
      style={{
        background: cfg.bg,
        color: cfg.fg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: size === "sm" ? 6 : 7,
          height: size === "sm" ? 6 : 7,
          background: cfg.dot,
        }}
      />
      {cfg.label}
    </span>
  );
}
