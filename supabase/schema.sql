-- Zad Workspace — full schema
-- Run this in Supabase SQL editor.
-- Every table has deleted_at for soft delete. Never hard delete.

create extension if not exists "pgcrypto";

-- ============ CUSTOMERS ============
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  study text,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_customers_phone on customers(phone) where deleted_at is null;
create index if not exists idx_customers_name on customers(name) where deleted_at is null;

-- ============ ROOMS ============
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity int not null default 1,
  -- 12 hourly prices stored as jsonb [{"hour":1,"price":50},...,{"hour":12,"price":400}]
  hourly_prices jsonb not null default '[]'::jsonb,
  label_color text not null default '#354A37',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============ INVENTORY / ITEMS ============
create type item_category as enum ('Snack','Drink','Product','Service');
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  category item_category not null default 'Product',
  stock int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id),
  quantity int not null, -- positive = restock, negative = sold
  reason text,
  created_at timestamptz not null default now(),
  created_by text not null default 'admin'
);

-- ============ PLANS / SUBSCRIPTIONS ============
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  letter text not null,           -- Z, N, F...
  hours int not null,
  price numeric(10,2) not null,
  available_seats int not null default 0,
  expiration_days int not null,
  label_color text not null default '#354A37',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- Z001, N002, ...
  name text not null,
  phone text not null,
  plan_id uuid not null references plans(id),
  payment_method text not null,
  total_price numeric(10,2) not null,
  total_hours int not null,
  hours_remaining numeric(10,2) not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_subscribers_phone on subscribers(phone) where deleted_at is null;
create index if not exists idx_subscribers_name on subscribers(name) where deleted_at is null;

-- ============ SESSIONS ============
create type session_status as enum ('active','closed');
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  subscriber_id uuid references subscribers(id),
  room_id uuid not null references rooms(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int,
  session_price numeric(10,2) not null default 0,  -- 0 for subscribers
  status session_status not null default 'active',
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (customer_id is not null or subscriber_id is not null)
);
create index if not exists idx_sessions_status on sessions(status) where deleted_at is null;

-- ============ ORDERS (items consumed in a session) ============
create table if not exists session_orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  item_id uuid not null references items(id),
  item_name text not null,         -- snapshot
  unit_price numeric(10,2) not null,
  quantity int not null,
  line_total numeric(10,2) not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============ INVOICES / PAYMENTS ============
create type invoice_kind as enum ('session','subscription');
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  kind invoice_kind not null,
  session_id uuid references sessions(id),
  subscriber_id uuid references subscribers(id),
  customer_name text,
  items jsonb not null default '[]'::jsonb,  -- [{name, qty, price, total}]
  session_amount numeric(10,2) not null default 0,
  orders_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null,
  payment_method text not null default 'cash',
  created_by text not null default 'admin',
  issued_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_invoices_issued_at on invoices(issued_at) where deleted_at is null;
create index if not exists idx_invoices_kind on invoices(kind) where deleted_at is null;

-- ============ AUTO updated_at TRIGGERS ============
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$ declare t text;
begin
  for t in select unnest(array['customers','rooms','items','plans','subscribers','sessions'])
  loop
    execute format('drop trigger if exists trg_%I_updated on %I; create trigger trg_%I_updated before update on %I for each row execute function set_updated_at();', t, t, t, t);
  end loop;
end $$;

-- ============ ROW LEVEL SECURITY ============
-- Simple policy: any authenticated user can do anything.
-- Tighten later when staff page is added.
alter table customers enable row level security;
alter table rooms enable row level security;
alter table items enable row level security;
alter table stock_movements enable row level security;
alter table plans enable row level security;
alter table subscribers enable row level security;
alter table sessions enable row level security;
alter table session_orders enable row level security;
alter table invoices enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['customers','rooms','items','stock_movements','plans','subscribers','sessions','session_orders','invoices'])
  loop
    execute format('drop policy if exists "auth_all" on %I; create policy "auth_all" on %I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;
