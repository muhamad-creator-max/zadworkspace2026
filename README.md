# Zad Workspace

Coworking management system — Next.js (App Router) + Tailwind + Supabase. Modular structure under `src/features/*`.

## Phase 1 (this build)
- Project scaffold, brand theme (90% scale, soft shadows, light/dark)
- Supabase Auth with seeded admin
- Full DB schema (soft-delete on every table)
- Customers module: search, add, edit, soft-delete, start/end session
- Dashboard: global check-in/out search + room board (active sessions, add orders, checkout)
- Stubs for Rooms, Inventory, Subscriptions, Transactions, Checkout

## Setup

1. Install deps
   ```powershell
   npm install
   ```

2. Create your Supabase project, then copy keys:
   ```powershell
   copy .env.local.example .env.local
   ```
   Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (used later for admin tasks)

3. In Supabase SQL Editor, run **`supabase/schema.sql`** then **`supabase/seed.sql`**.

4. In Supabase **Authentication → Users → Add user**, create:
   - Email: `admin@zad.local`
   - Password: `123123`
   - Auto-confirm: yes

5. Run the app
   ```powershell
   npm run dev
   ```
   Sign in at `/login` with username `admin` / password `123123`.

## Directory layout

```
src/
  app/                Next.js routes
    (app)/            Authenticated routes (sidebar + topbar)
    login/            Public login
  components/
    layout/           Sidebar, Topbar, ThemeToggle, Placeholder
    ui/               Modal, Toast, ConfirmDialog (shared primitives)
  features/           Modular feature folders
    customers/        api + modals
    sessions/         api + StartSession + AddOrders modals
  lib/
    supabase/         client / server / middleware
    types.ts          shared domain types
    format.ts, pricing.ts
supabase/
  schema.sql          full DB schema (run once)
  seed.sql            sample rooms + items
```

## Brand
- Primary green `#354A37` • White `#FFFFFF` • Black `#000000`
- Danger (alerts) `#FAA9A9` • Success `#D0FFB6`
- 90% global scale (set on `:root` font-size)
- Soft shadows via `shadow-soft` / `shadow-soft-lg`
- Dark mode toggle stored in `localStorage` as `zad-theme`

## Soft delete
Every table has `deleted_at`. All list queries filter `deleted_at IS NULL`. Past sessions, invoices, and transactions remain intact when entities are edited or removed.

## Next phases
- Rooms (cards + hourly pricing matrix)
- Inventory (Trello board + restock)
- Subscriptions (plans + auto-coded subscribers + subscription invoice)
- Checkout (full duration/price calc, orders panel, invoice PDF + print)
- Transactions (filters, sorting, three-way switch)
