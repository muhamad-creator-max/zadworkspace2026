-- ============ FINANCE: EXPENSES & INCOMES + DELETE LOG ============
-- Run this in Supabase SQL editor after schema.sql and staff_schema.sql

-- ============ EXPENSES ============
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reason text,
  amount numeric(10,2) not null,
  payment_method text not null default 'Cash',
  payment_due timestamptz not null default now(),
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_expenses_payment_due on expenses(payment_due) where deleted_at is null;
create index if not exists idx_expenses_created_at on expenses(created_at) where deleted_at is null;

-- ============ INCOMES (manual/extra income, separate from invoices) ============
create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reason text,
  amount numeric(10,2) not null,
  payment_method text not null default 'Cash',
  payment_due timestamptz not null default now(),
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_incomes_payment_due on incomes(payment_due) where deleted_at is null;
create index if not exists idx_incomes_created_at on incomes(created_at) where deleted_at is null;

-- ============ DELETE LOG ============
-- One row per soft-deleted entity (expense, income, invoice, etc).
create table if not exists delete_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,            -- 'expense' | 'income' | 'invoice' | ...
  entity_id uuid not null,
  entity_label text,                    -- human-readable description (name / customer / etc)
  entity_amount numeric(10,2),          -- optional amount snapshot
  snapshot jsonb,                       -- full record snapshot
  deleted_by text not null default 'admin',
  deleted_at timestamptz not null default now()
);
create index if not exists idx_delete_log_entity on delete_log(entity_type, entity_id);
create index if not exists idx_delete_log_deleted_at on delete_log(deleted_at);

-- ============ updated_at TRIGGERS ============
do $$ declare t text;
begin
  for t in select unnest(array['expenses','incomes'])
  loop
    execute format('drop trigger if exists trg_%I_updated on %I; create trigger trg_%I_updated before update on %I for each row execute function set_updated_at();', t, t, t, t);
  end loop;
end $$;

-- ============ RLS ============
alter table expenses    enable row level security;
alter table incomes     enable row level security;
alter table delete_log  enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['expenses','incomes','delete_log'])
  loop
    execute format('drop policy if exists "auth_all" on %I; create policy "auth_all" on %I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;
