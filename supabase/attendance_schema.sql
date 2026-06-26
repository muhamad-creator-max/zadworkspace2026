-- ============ ATTENDANCE SYSTEM ============
-- Staff sign-in / sign-out sheet.
-- A staff member types a sign name (free text), which records a check-in at the
-- current time. The check-out time stays empty until the "Check Out" button is
-- pressed, which stamps the current time.
-- Run this in Supabase SQL editor after staff_schema.sql

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  sign_name text not null,

  -- Set once on insert, never editable from the UI.
  check_in timestamptz not null default now(),

  -- Empty until the staff presses "Check Out".
  check_out timestamptz,

  -- Who recorded the row (for auditing). Optional.
  created_by uuid references staff_members(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_attendance_check_in on attendance(check_in) where deleted_at is null;
create index if not exists idx_attendance_sign_name on attendance(sign_name) where deleted_at is null;

-- Auto-update updated_at
create or replace function set_attendance_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_attendance_updated_at on attendance;
create trigger trg_attendance_updated_at
  before update on attendance
  for each row execute function set_attendance_updated_at();

-- ============ RLS ============
alter table attendance enable row level security;

-- Any authenticated staff member can read the attendance sheet.
create policy "attendance_select_authenticated" on attendance
  for select to authenticated using (true);

-- Any authenticated staff member can sign in (create a row).
create policy "attendance_insert_authenticated" on attendance
  for insert to authenticated with check (true);

-- Any authenticated staff member can update (used for check-out / soft delete).
create policy "attendance_update_authenticated" on attendance
  for update to authenticated using (true) with check (true);
