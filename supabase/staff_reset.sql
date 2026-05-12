-- ============ DROP EVERYTHING FIRST ============
drop policy if exists "anyone_submit_request" on access_requests;
drop policy if exists "view_own_or_admin_requests" on access_requests;
drop policy if exists "admin_update_requests" on access_requests;
drop policy if exists "staff_view_own_member" on staff_members;
drop policy if exists "admin_all_on_staff" on staff_members;
drop policy if exists "view_own_or_admin_access" on page_access;
drop policy if exists "admin_manage_access" on page_access;

drop table if exists page_access cascade;
drop table if exists access_requests cascade;
drop table if exists staff_members cascade;

drop type if exists staff_role cascade;
drop type if exists access_request_status cascade;

-- ============ RECREATE TABLES ============
create type staff_role as enum ('admin', 'staff');
create type access_request_status as enum ('pending', 'approved', 'declined');

create table staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role staff_role not null default 'staff',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_staff_members_user_id on staff_members(user_id) where deleted_at is null;
create index idx_staff_members_email on staff_members(email) where deleted_at is null;

create table access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  phone text,
  status access_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references staff_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_access_requests_status on access_requests(status) where deleted_at is null;
create index idx_access_requests_email on access_requests(email) where deleted_at is null;

create table page_access (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_members(id) on delete cascade,
  page_path text not null,
  created_at timestamptz not null default now(),
  unique(staff_id, page_path)
);
create index idx_page_access_staff on page_access(staff_id);

-- ============ RLS POLICIES ============
alter table staff_members enable row level security;
alter table access_requests enable row level security;
alter table page_access enable row level security;

-- Anyone (including unauthenticated) can submit an access request
create policy "anyone_submit_request" on access_requests
  for insert to anon, authenticated with check (true);

-- Staff can view their own request; admin can view all
create policy "view_own_or_admin_requests" on access_requests
  for select to authenticated using (
    email = (select email from auth.users where id = auth.uid()) or
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  );

-- Only admin can update access requests
create policy "admin_update_requests" on access_requests
  for update to authenticated using (
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  ) with check (
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  );

-- Staff can view their own record; admin can view all
create policy "staff_view_own_member" on staff_members
  for select to authenticated using (
    auth.uid() = user_id or
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  );

-- Only admin can modify staff members
create policy "admin_all_on_staff" on staff_members
  for all to authenticated using (
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  ) with check (
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  );

-- Staff can view own page_access; admin can view all
create policy "view_own_or_admin_access" on page_access
  for select to authenticated using (
    staff_id = (select id from staff_members where user_id = auth.uid() and deleted_at is null) or
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  );

-- Only admin can manage page_access
create policy "admin_manage_access" on page_access
  for all to authenticated using (
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  ) with check (
    (select role from staff_members where user_id = auth.uid() and deleted_at is null) = 'admin'
  );

-- ============ SEED ADMIN ============
insert into staff_members (user_id, email, name, role)
select id, email, 'Admin', 'admin'
from auth.users
where email = 'admin@zad.local'
on conflict (email) do nothing;
