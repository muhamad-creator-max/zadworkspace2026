"use client";
import { createClient } from "@/lib/supabase/client";
import { getCurrentStaffMember } from "@/features/staff/api";
import type { Task, TaskAssignment, TaskStatus, StaffMember } from "@/lib/types";

const sb = () => createClient();

const todayLocalDate = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// "HH:MM" or "HH:MM:SS" -> minutes since midnight (local)
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export interface CreateTaskInput {
  content: string;
  status: TaskStatus;
  alert_at: string | null;        // ISO timestamp or null
  pin_enabled: boolean;
  pin_time: string | null;        // 'HH:MM' or 'HH:MM:SS'
  assignee_ids: string[];          // staff_member ids
}

export interface UpdateTaskInput {
  content?: string;
  status?: TaskStatus;
  alert_at?: string | null;
  pin_enabled?: boolean;
  pin_time?: string | null;
  assignee_ids?: string[];
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const me = await getCurrentStaffMember();
  if (!me) throw new Error("Not authenticated");

  const { data: task, error } = await sb()
    .from("tasks")
    .insert({
      content: input.content,
      created_by: me.id,
      status: input.status,
      alert_at: input.alert_at,
      pin_enabled: input.pin_enabled,
      pin_time: input.pin_time,
    })
    .select()
    .single();
  if (error) throw error;

  // Ensure creator is implicit assignee if they didn't add themselves
  const assigneeSet = new Set(input.assignee_ids);
  if (assigneeSet.size === 0) assigneeSet.add(me.id);

  const rows = Array.from(assigneeSet).map((aid) => ({
    task_id: task.id,
    assignee_id: aid,
  }));
  const { error: aErr } = await sb().from("task_assignments").insert(rows);
  if (aErr) throw aErr;

  return task;
}

export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.content !== undefined) updates.content = input.content;
  if (input.status !== undefined) updates.status = input.status;
  if (input.alert_at !== undefined) updates.alert_at = input.alert_at;
  if (input.pin_enabled !== undefined) updates.pin_enabled = input.pin_enabled;
  if (input.pin_time !== undefined) updates.pin_time = input.pin_time;

  if (Object.keys(updates).length > 0) {
    const { error } = await sb().from("tasks").update(updates).eq("id", taskId);
    if (error) throw error;
  }

  if (input.assignee_ids) {
    const { data: existing, error: exErr } = await sb()
      .from("task_assignments")
      .select("*")
      .eq("task_id", taskId);
    if (exErr) throw exErr;

    const want = new Set(input.assignee_ids);
    const have = new Set((existing ?? []).map((a) => a.assignee_id));

    const toAdd = [...want].filter((x) => !have.has(x));
    const toRemove = (existing ?? []).filter((a) => !want.has(a.assignee_id));

    if (toAdd.length) {
      const { error } = await sb()
        .from("task_assignments")
        .insert(toAdd.map((aid) => ({ task_id: taskId, assignee_id: aid })));
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await sb()
        .from("task_assignments")
        .delete()
        .in(
          "id",
          toRemove.map((r) => r.id)
        );
      if (error) throw error;
    }
  }
}

export async function softDeleteTask(taskId: string): Promise<void> {
  const { error } = await sb()
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) throw error;
}

// Toggle done state for the CURRENT staff member's own assignment row.
// Rule: checking does NOT affect other assignees.
export async function toggleAssignmentDone(
  assignmentId: string,
  done: boolean
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    done_at: done ? now : null,
    last_done_date: done ? todayLocalDate() : null,
  };
  const { error } = await sb()
    .from("task_assignments")
    .update(updates)
    .eq("id", assignmentId);
  if (error) throw error;
}

// All tasks visible to the current staff member, with their own assignment row attached.
export async function listMyTasks(): Promise<
  Array<Task & { my_assignment: TaskAssignment | null }>
> {
  const me = await getCurrentStaffMember();
  if (!me) return [];

  const { data, error } = await sb()
    .from("tasks")
    .select(
      `
      *,
      creator:created_by(id, name, email),
      assignments:task_assignments(
        id, task_id, assignee_id, done_at, last_done_date, created_at,
        assignee:assignee_id(id, name, email)
      )
    `
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((t: any) => ({
    ...t,
    my_assignment:
      (t.assignments as TaskAssignment[] | null)?.find(
        (a) => a.assignee_id === me.id
      ) ?? null,
  }));
}

// Tasks for the current member that should appear on the dashboard RIGHT NOW.
// Rules:
// - Status "done" never shows (the user already closed it).
// - Status "scheduled": only shows after its alert_at moment.
// - Status "not_done": shows. If alert_at is set, gate visibility by alert_at <= now.
// - If task is pinned (daily): only show if today's clock-time has passed pin_time,
//   and the assignee hasn't marked it done today.
// - If the assignee already marked done today, hide (no overlap with next-day repeat).
export async function listMyDashboardTasks(): Promise<
  Array<Task & { my_assignment: TaskAssignment }>
> {
  const me = await getCurrentStaffMember();
  if (!me) return [];

  const { data, error } = await sb()
    .from("tasks")
    .select(
      `
      *,
      creator:created_by(id, name, email),
      assignments:task_assignments!inner(
        id, task_id, assignee_id, done_at, last_done_date, created_at
      )
    `
    )
    .is("deleted_at", null)
    .eq("assignments.assignee_id", me.id);
  if (error) throw error;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = todayLocalDate();

  const out: Array<Task & { my_assignment: TaskAssignment }> = [];
  for (const t of (data ?? []) as any[]) {
    const mine: TaskAssignment | undefined = (t.assignments ?? [])[0];
    if (!mine) continue;

    // Already done — never show
    if (mine.done_at) continue;

    // Pinned (daily repeat) takes priority
    if (t.pin_enabled && t.pin_time) {
      // Hide if already done today (prevents overlap on the same day).
      if (mine.last_done_date === today) continue;
      // Wait until pin_time arrives in local clock.
      if (timeToMinutes(t.pin_time) > nowMin) continue;
      out.push({ ...t, my_assignment: mine });
      continue;
    }

    // Status gating
    if (t.status === "done") continue;
    if (t.status === "scheduled") {
      if (!t.alert_at) continue;
      if (new Date(t.alert_at) > now) continue;
    } else {
      // not_done — respect alert_at if set
      if (t.alert_at && new Date(t.alert_at) > now) continue;
    }

    out.push({ ...t, my_assignment: mine });
  }
  return out;
}

// Should the sidebar show a red dot? True if there's at least one task that:
//  - is assigned to me
//  - I haven't marked done
//  - has an alert_at <= now (firing) OR is a pinned task whose pin_time has fired today
export async function hasActiveTaskAlerts(): Promise<boolean> {
  const tasks = await listMyDashboardTasks();
  if (!tasks.length) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return tasks.some((t) => {
    if (t.pin_enabled && t.pin_time) return timeToMinutes(t.pin_time) <= nowMin;
    if (t.alert_at) return new Date(t.alert_at) <= now;
    return false;
  });
}

export async function listAssignableStaff(): Promise<StaffMember[]> {
  const { data, error } = await sb()
    .from("staff_members")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
