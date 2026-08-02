-- DOUBLE A POS — initial schema.
-- Supabase (Postgres) is the single source of truth for products, prices,
-- inventory, users and sales history. The mobile app's SQLite database is a
-- disposable working copy of this schema.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users (cashiers / admins)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null default 'cashier' check (role in ('cashier', 'admin', 'device')),
  -- Links an app user to a Supabase Auth account. Admins have one (they log in
  -- to the dashboard) and so does each POS terminal (role = 'device', enrolled
  -- once so sync calls are authenticated). Plain cashiers do not: they unlock
  -- the POS with a local PIN and never authenticate over the network.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  -- SHA-256 of (pin + id) — lets the mobile app unlock a cashier session with
  -- no network call at all. Never stores the raw PIN.
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  price numeric(10, 2) not null check (price >= 0),
  -- Maintained exclusively by the inventory trigger below. Allowed to go
  -- negative: negative stock is how an oversell from two offline devices
  -- surfaces for manual resolution.
  stock_quantity integer not null default 0,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sales (header) — id is generated on-device, never server-side
-- ---------------------------------------------------------------------------
create table public.sales (
  id uuid primary key,
  user_id uuid references public.users (id) on delete set null,
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  payment_method text check (payment_method in ('cash', 'gcash', 'card', 'other')),
  status text not null default 'completed' check (status in ('completed', 'voided', 'refunded')),
  device_id text,
  created_at timestamptz not null,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sale_items — mobile supplies its own id so a retried push is idempotent
-- ---------------------------------------------------------------------------
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inventory_movements — the only path by which stock ever changes
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  change_quantity integer not null check (change_quantity <> 0),
  reason text not null check (
    reason in ('sale', 'restock', 'adjustment', 'oversell_correction', 'void_restore')
  ),
  -- Deliberately not a foreign key: points at sales.id for reason='sale' and
  -- at nothing at all for restocks and adjustments.
  reference_id uuid,
  note text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- indexes — the mobile pull filters on updated_at, reporting filters on dates
-- ---------------------------------------------------------------------------
create index products_updated_at_idx on public.products (updated_at);
create index products_active_idx on public.products (is_active) where is_active;
create index users_updated_at_idx on public.users (updated_at);
create index users_auth_user_id_idx on public.users (auth_user_id);
create index sales_created_at_idx on public.sales (created_at desc);
create index sales_user_id_idx on public.sales (user_id);
create index sales_device_id_idx on public.sales (device_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);
create index inventory_movements_product_id_idx on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_reference_id_idx on public.inventory_movements (reference_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

create trigger sales_touch_updated_at
  before update on public.sales
  for each row execute function public.touch_updated_at();
