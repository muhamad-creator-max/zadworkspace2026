-- ============ TASKS RLS RECURSION FIX ============
-- Previous policies on `tasks` and `task_assignments` referenced each other,
-- producing "infinite recursion detected in policy for relation tasks".
--
-- Fix: use SECURITY DEFINER helpers so the policy bodies don't re-trigger RLS
-- on the same tables, and break the cross-table EXISTS chain.
--
-- Run this entire block in the Supabase SQL editor.

-- Helper: current authenticated user's staff_members.id (or NULL).
-- SECURITY DEFINER bypasses RLS when reading staff_members.
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

-- Helper: does the given task belong to the current staff member as creator?
-- SECURITY DEFINER lets it read `tasks` without re-entering RLS.
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

-- Helper: is the current staff member assigned to the given task?
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

-- Drop the old recursive policies.
drop policy if exists "tasks_select_own_or_assigned"       on tasks;
drop policy if exists "tasks_insert_self"                  on tasks;
drop policy if exists "tasks_update_creator"               on tasks;
drop policy if exists "tasks_delete_creator"               on tasks;
drop policy if exists "task_assign_select_self_or_creator" on task_assignments;
drop policy if exists "task_assign_insert_creator"         on task_assignments;
drop policy if exists "task_assign_update_self_or_creator" on task_assignments;
drop policy if exists "task_assign_delete_creator"         on task_assignments;

-- ===== tasks =====
create policy "tasks_select_own_or_assigned" on tasks
  for select to authenticated using (
    created_by = current_staff_id()
    or is_task_assignee(id)
  );

create policy "tasks_insert_self" on tasks
  for insert to authenticated with check (
    created_by = current_staff_id()
  );

create policy "tasks_update_creator" on tasks
  for update to authenticated
  using (created_by = current_staff_id())
  with check (created_by = current_staff_id());

create policy "tasks_delete_creator" on tasks
  for delete to authenticated using (
    created_by = current_staff_id()
  );

-- ===== task_assignments =====
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
