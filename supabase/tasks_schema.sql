-- ============ TASKS / NOTES SYSTEM ============
-- Personal & shared task notes for staff members.
-- Run this in Supabase SQL editor after staff_schema.sql

create type task_status as enum ('not_done', 'done', 'scheduled');

-- Master task record (one per task, regardless of how many assignees)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_by uuid not null references staff_members(id) on delete cascade,
  status task_status not null default 'not_done',

  -- Alert (one-time reminder)
  alert_at timestamptz,

  -- Pin (daily repeat at a specific clock time)
  pin_enabled boolean not null default false,
  pin_time time,  -- e.g. '09:30:00' — clock time only, applied daily

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_tasks_created_by on tasks(created_by) where deleted_at is null;
create index if not exists idx_tasks_alert_at on tasks(alert_at) where deleted_at is null;
create index if not exists idx_tasks_pin on tasks(pin_enabled) where deleted_at is null and pin_enabled = true;

-- Per-assignee row: each assignee has their own done state
create table if not exists task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  assignee_id uuid not null references staff_members(id) on delete cascade,

  -- Per-assignee done state
  done_at timestamptz,

  -- For pinned (daily-repeat) tasks: tracks the date the assignee last marked it
  -- done. Same-day done -> hide from today's dashboard until tomorrow.
  last_done_date date,

  created_at timestamptz not null default now(),
  unique(task_id, assignee_id)
);
create index if not exists idx_task_assign_assignee on task_assignments(assignee_id);
create index if not exists idx_task_assign_task on task_assignments(task_id);

-- Auto-update updated_at on tasks
create or replace function set_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function set_tasks_updated_at();

-- ============ RLS ============
alter table tasks enable row level security;
alter table task_assignments enable row level security;

-- SECURITY DEFINER helpers — used so policies don't recursively re-enter RLS
-- on the same tables (which would cause "infinite recursion in policy").

create or replace function current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from staff_members
  where user_id = auth.uid() and deleted_at is null
  limit 1
$$;

create or replace function is_task_creator(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tasks
    where id = p_task_id
      and created_by = current_staff_id()
  )
$$;

create or replace function is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from task_assignments
    where task_id = p_task_id
      and assignee_id = current_staff_id()
  )
$$;

-- A staff member sees tasks they created OR are assigned to.
create policy "tasks_select_own_or_assigned" on tasks
  for select to authenticated using (
    created_by = current_staff_id()
    or is_task_assignee(id)
  );

-- Anyone authenticated as staff can create a task (they become the creator).
create policy "tasks_insert_self" on tasks
  for insert to authenticated with check (
    created_by = current_staff_id()
  );

-- Only the creator can update/delete the master task.
create policy "tasks_update_creator" on tasks
  for update to authenticated
  using (created_by = current_staff_id())
  with check (created_by = current_staff_id());

create policy "tasks_delete_creator" on tasks
  for delete to authenticated using (
    created_by = current_staff_id()
  );

-- task_assignments: an assignee can see + update their own row.
-- Creator of the task can see all rows for their task.
create policy "task_assign_select_self_or_creator" on task_assignments
  for select to authenticated using (
    assignee_id = current_staff_id()
    or is_task_creator(task_id)
  );

create policy "task_assign_insert_creator" on task_assignments
  for insert to authenticated with check (
    is_task_creator(task_id)
  );

create policy "task_assign_update_self_or_creator" on task_assignments
  for update to authenticated
  using (
    assignee_id = current_staff_id()
    or is_task_creator(task_id)
  )
  with check (
    assignee_id = current_staff_id()
    or is_task_creator(task_id)
  );

create policy "task_assign_delete_creator" on task_assignments
  for delete to authenticated using (
    is_task_creator(task_id)
  );
