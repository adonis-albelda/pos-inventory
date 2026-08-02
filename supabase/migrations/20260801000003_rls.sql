-- Row level security.
--
-- Two kinds of authenticated caller:
--   * admin  — a person logged into apps/admin with Supabase Auth.
--   * device — a POS terminal enrolled once during setup. Its session is
--              persisted on-device so every later sync is authenticated
--              without the cashier ever logging in over the network.
--
-- Cashiers themselves are not Supabase Auth users. They are rows in
-- public.users unlocked by a local PIN, and their identity travels as
-- sales.user_id inside data the device pushes.

alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;

-- ---------------------------------------------------------------------------
-- Role helpers. security definer so they can read public.users without
-- recursing through that table's own policies.
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
    from public.users u
   where u.auth_user_id = auth.uid()
     and u.is_active
   limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'admin';
$$;

-- ---------------------------------------------------------------------------
-- products — everyone authenticated reads (the device pulls them), admin writes
-- ---------------------------------------------------------------------------
create policy products_select on public.products
  for select to authenticated using (true);

create policy products_insert on public.products
  for insert to authenticated with check (public.is_admin());

create policy products_update on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy products_delete on public.products
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- users — readable by any authenticated caller so a device can pull the
-- cashier list. pin_hash is protected by a column grant below, not a policy.
-- ---------------------------------------------------------------------------
create policy users_select on public.users
  for select to authenticated using (true);

create policy users_insert on public.users
  for insert to authenticated with check (public.is_admin());

create policy users_update on public.users
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy users_delete on public.users
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- sales / sale_items — a device inserts what it pushed, admin can amend
-- (void/refund). Nobody deletes sales; voiding is the reversal path.
-- ---------------------------------------------------------------------------
create policy sales_select on public.sales
  for select to authenticated using (true);

create policy sales_insert on public.sales
  for insert to authenticated
  with check (public.current_app_role() in ('device', 'admin'));

create policy sales_update on public.sales
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy sale_items_select on public.sale_items
  for select to authenticated using (true);

create policy sale_items_insert on public.sale_items
  for insert to authenticated
  with check (public.current_app_role() in ('device', 'admin'));

-- ---------------------------------------------------------------------------
-- inventory_movements — read for audit, write only through admin actions.
-- Sale-driven movements are written by a security definer trigger, which
-- bypasses these policies by design.
-- ---------------------------------------------------------------------------
create policy inventory_movements_select on public.inventory_movements
  for select to authenticated using (true);

create policy inventory_movements_insert on public.inventory_movements
  for insert to authenticated with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Column-level protection for pin_hash.
--
-- Devices need to read the cashier list, but they only need to compare a PIN,
-- never to read other people's hashes wholesale. Verification happens through
-- verify_pin() instead, so pin_hash itself is revoked from normal callers.
-- ---------------------------------------------------------------------------
revoke all on public.users from authenticated;
grant select (id, name, email, role, is_active, created_at, updated_at)
  on public.users to authenticated;
grant insert, update, delete on public.users to authenticated;

-- A device pulls hashes for the cashiers it is allowed to unlock, so PIN
-- checks work with no connectivity. Exposed as an explicit function so the
-- surface is one auditable call rather than a readable column.
create or replace function public.cashier_pins()
returns table (id uuid, pin_hash text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.pin_hash
    from public.users u
   where u.is_active
     and u.role in ('cashier', 'admin')
     and public.current_app_role() in ('device', 'admin');
$$;

grant execute on function public.cashier_pins() to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text, text, uuid) to authenticated;
