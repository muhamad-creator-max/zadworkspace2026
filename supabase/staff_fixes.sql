-- Staff Management System - Fixes for Existing Installations
-- Run this if you already ran staff_schema.sql and want to apply the fixes
-- Otherwise, just re-run staff_schema.sql from scratch

-- Fix 1: Allow unauthenticated users to submit access requests
-- Previous policy required authenticated users
drop policy if exists "anyone_submit_request" on access_requests;
create policy "anyone_submit_request" on access_requests
  for insert to anon, authenticated with check (true);

-- Fix 2: Make user_id nullable in staff_members
-- Previously not null, but we don't create auth users during approval
-- User is created when staff member first logs in
alter table staff_members alter column user_id drop not null;

-- Fix 3: Seed default admin staff record (if not exists)
insert into staff_members (user_id, email, name, role)
select id, email, 'Admin', 'admin'
from auth.users
where email = 'admin@zad.local'
on conflict (email) do nothing;
