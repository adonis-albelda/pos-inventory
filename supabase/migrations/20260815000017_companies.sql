-- Multi-company tenancy. Additive only: wrap the live shop as company 1.
-- No DROP TABLE, no DELETE of business rows. Same UUIDs, Auth links, PINs, stock.

-- ---------------------------------------------------------------------------
-- 1. companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

alter table public.companies enable row level security;

-- ---------------------------------------------------------------------------
-- 2. company_id columns (nullable until backfill)
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists company_id uuid references public.companies (id);
alter table public.products add column if not exists company_id uuid references public.companies (id);
alter table public.sales add column if not exists company_id uuid references public.companies (id);
alter table public.sale_items add column if not exists company_id uuid references public.companies (id);
alter table public.inventory_movements add column if not exists company_id uuid references public.companies (id);
alter table public.categories add column if not exists company_id uuid references public.companies (id);
alter table public.customers add column if not exists company_id uuid references public.companies (id);
alter table public.expenses add column if not exists company_id uuid references public.companies (id);
alter table public.suppliers add column if not exists company_id uuid references public.companies (id);
alter table public.supplier_products add column if not exists company_id uuid references public.companies (id);
alter table public.purchase_orders add column if not exists company_id uuid references public.companies (id);
alter table public.purchase_order_items add column if not exists company_id uuid references public.companies (id);
alter table public.purchase_order_payments add column if not exists company_id uuid references public.companies (id);
alter table public.store_settings add column if not exists company_id uuid references public.companies (id);
alter table public.receipt_layout add column if not exists company_id uuid references public.companies (id);

-- ---------------------------------------------------------------------------
-- 3. Backfill: one company from the existing store_settings row
-- ---------------------------------------------------------------------------
do $$
declare
  v_company_id uuid;
  v_name text;
begin
  select coalesce(nullif(trim(ss.name), ''), 'DOUBLE A')
    into v_name
    from public.store_settings ss
   limit 1;

  if v_name is null then
    v_name := 'DOUBLE A';
  end if;

  insert into public.companies (name, is_active)
  values (v_name, true)
  returning id into v_company_id;

  update public.users set company_id = v_company_id where company_id is null;
  update public.products set company_id = v_company_id where company_id is null;
  update public.sales set company_id = v_company_id where company_id is null;
  update public.sale_items set company_id = v_company_id where company_id is null;
  update public.inventory_movements set company_id = v_company_id where company_id is null;
  update public.categories set company_id = v_company_id where company_id is null;
  update public.customers set company_id = v_company_id where company_id is null;
  update public.expenses set company_id = v_company_id where company_id is null;
  update public.suppliers set company_id = v_company_id where company_id is null;
  update public.supplier_products set company_id = v_company_id where company_id is null;
  update public.purchase_orders set company_id = v_company_id where company_id is null;
  update public.purchase_order_items set company_id = v_company_id where company_id is null;
  update public.purchase_order_payments set company_id = v_company_id where company_id is null;
  update public.store_settings set company_id = v_company_id where company_id is null;
  update public.receipt_layout set company_id = v_company_id where company_id is null;

  if not exists (select 1 from public.store_settings where company_id = v_company_id) then
    insert into public.store_settings (id, company_id, name) values (true, v_company_id, v_name);
  end if;

  if not exists (select 1 from public.receipt_layout where company_id = v_company_id) then
    insert into public.receipt_layout (id, company_id) values (true, v_company_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. NOT NULL (users.company_id stays nullable for superadmin)
-- ---------------------------------------------------------------------------
alter table public.products alter column company_id set not null;
alter table public.sales alter column company_id set not null;
alter table public.sale_items alter column company_id set not null;
alter table public.inventory_movements alter column company_id set not null;
alter table public.categories alter column company_id set not null;
alter table public.customers alter column company_id set not null;
alter table public.expenses alter column company_id set not null;
alter table public.suppliers alter column company_id set not null;
alter table public.supplier_products alter column company_id set not null;
alter table public.purchase_orders alter column company_id set not null;
alter table public.purchase_order_items alter column company_id set not null;
alter table public.purchase_order_payments alter column company_id set not null;
alter table public.store_settings alter column company_id set not null;
alter table public.receipt_layout alter column company_id set not null;

-- Role may now be superadmin. Existing rows are cashier/admin/device.
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('cashier', 'admin', 'device', 'superadmin'));

alter table public.users drop constraint if exists users_company_role_ck;
alter table public.users
  add constraint users_company_role_ck
  check (
    (role = 'superadmin' and company_id is null)
    or (role <> 'superadmin' and company_id is not null)
  );

-- ---------------------------------------------------------------------------
-- 5. store_settings / receipt_layout: boolean singleton PK -> company_id PK
--    ALTER in place. The existing row survives as company 1's settings.
-- ---------------------------------------------------------------------------
alter table public.store_settings drop constraint if exists store_settings_pkey;
alter table public.store_settings drop constraint if exists store_settings_id_check;
alter table public.store_settings drop column if exists id;
alter table public.store_settings add primary key (company_id);

alter table public.receipt_layout drop constraint if exists receipt_layout_pkey;
alter table public.receipt_layout drop constraint if exists receipt_layout_id_check;
alter table public.receipt_layout drop column if exists id;
alter table public.receipt_layout add primary key (company_id);

-- ---------------------------------------------------------------------------
-- 6. Uniques become per-company (index swap, not a data rewrite)
-- ---------------------------------------------------------------------------
alter table public.users drop constraint if exists users_email_key;
create unique index if not exists users_company_email_idx
  on public.users (company_id, lower(email))
  where company_id is not null;
create unique index if not exists users_superadmin_email_idx
  on public.users (lower(email))
  where company_id is null;

alter table public.products drop constraint if exists products_sku_key;
create unique index if not exists products_company_sku_idx
  on public.products (company_id, sku)
  where sku is not null;

drop index if exists public.products_barcode_idx;
create unique index products_barcode_idx
  on public.products (company_id, barcode)
  where barcode is not null;

drop index if exists public.categories_sibling_name_idx;
create unique index categories_sibling_name_idx
  on public.categories (
    company_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create index if not exists users_company_id_idx on public.users (company_id);
create index if not exists products_company_id_idx on public.products (company_id);
create index if not exists sales_company_id_idx on public.sales (company_id);
create index if not exists sale_items_company_id_idx on public.sale_items (company_id);
create index if not exists inventory_movements_company_id_idx on public.inventory_movements (company_id);
create index if not exists categories_company_id_idx on public.categories (company_id);
create index if not exists customers_company_id_idx on public.customers (company_id);
create index if not exists expenses_company_id_idx on public.expenses (company_id);
create index if not exists suppliers_company_id_idx on public.suppliers (company_id);

-- ---------------------------------------------------------------------------
-- 7. Session helpers
-- ---------------------------------------------------------------------------
create or replace function public.acting_company_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'acting_company_id', '')::uuid;
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.users u
     where u.auth_user_id = auth.uid()
       and u.is_active
       and u.role = 'superadmin'
  );
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
           when u.role = 'superadmin' then public.acting_company_id()
           else u.company_id
         end
    from public.users u
   where u.auth_user_id = auth.uid()
     and u.is_active
   limit 1;
$$;

create or replace function public.company_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.companies c
     where c.id = public.current_company_id()
       and c.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
      or (public.is_superadmin() and public.current_company_id() is not null);
$$;

-- Shop row is visible to its staff when the company is live, and to a
-- superadmin who has opened that company (including a disabled one, read-only).
create or replace function public.shop_readable(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company_id is not null
     and p_company_id = public.current_company_id()
     and (public.company_is_active() or public.is_superadmin());
$$;

create or replace function public.shop_writable(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company_id is not null
     and p_company_id = public.current_company_id()
     and public.company_is_active();
$$;

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'reports are available to admins only';
  end if;
  if public.current_company_id() is null then
    raise exception 'no company in session';
  end if;
end;
$$;

revoke all on function public.acting_company_id() from public;
revoke all on function public.is_superadmin() from public;
revoke all on function public.current_company_id() from public;
revoke all on function public.company_is_active() from public;
revoke all on function public.shop_readable(uuid) from public;
revoke all on function public.shop_writable(uuid) from public;

grant execute on function public.acting_company_id() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.company_is_active() to authenticated;
grant execute on function public.shop_readable(uuid) to authenticated;
grant execute on function public.shop_writable(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.assert_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Fill company_id on insert; never let it change afterwards
-- ---------------------------------------------------------------------------
create or replace function public.fill_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'company_id cannot change';
  end if;

  if new.company_id is null then
    new.company_id := public.current_company_id();
  end if;

  if new.company_id is null then
    raise exception 'company_id is required';
  end if;

  if auth.uid() is not null
     and not public.is_superadmin()
     and new.company_id is distinct from public.current_company_id() then
    raise exception 'company_id mismatch';
  end if;

  return new;
end;
$$;

create or replace function public.users_guard_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'superadmin' then
    if auth.uid() is not null and not public.is_superadmin() then
      raise exception 'cannot create superadmin';
    end if;
    new.company_id := null;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'company_id cannot change';
  end if;

  if new.company_id is null then
    new.company_id := public.current_company_id();
  end if;

  if new.company_id is null then
    raise exception 'company_id is required';
  end if;

  if auth.uid() is not null
     and not public.is_superadmin()
     and new.company_id is distinct from public.current_company_id() then
    raise exception 'company_id mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists users_fill_company_id on public.users;
create trigger users_fill_company_id
  before insert or update on public.users
  for each row execute function public.users_guard_company();

do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'sales', 'sale_items', 'inventory_movements', 'categories',
    'customers', 'expenses', 'suppliers', 'supplier_products', 'purchase_orders',
    'purchase_order_items', 'purchase_order_payments', 'store_settings',
    'receipt_layout'
  ]
  loop
    execute format('drop trigger if exists %I_fill_company_id on public.%I', t, t);
    execute format(
      'create trigger %I_fill_company_id before insert or update on public.%I for each row execute function public.fill_company_id()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. current_app_user includes company
-- ---------------------------------------------------------------------------
drop function if exists public.current_app_user();

create function public.current_app_user()
returns table (
  id uuid,
  name text,
  email text,
  role text,
  is_active boolean,
  can_sell boolean,
  must_change_password boolean,
  company_id uuid,
  company_is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.name,
    u.email,
    u.role,
    u.is_active,
    u.can_sell,
    u.must_change_password,
    u.company_id,
    coalesce(
      (select c.is_active from public.companies c where c.id = u.company_id),
      true
    ),
    u.created_at,
    u.updated_at
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active
  limit 1;
$$;

revoke all on function public.current_app_user() from public;
grant execute on function public.current_app_user() to authenticated;
grant execute on function public.current_app_user() to service_role;

revoke all on public.users from authenticated;
grant select (
  id, name, email, role, is_active, can_sell, must_change_password,
  company_id, created_at, updated_at
) on public.users to authenticated;
grant insert, update, delete on public.users to authenticated;

-- ---------------------------------------------------------------------------
-- 10. RLS: tenant wall
-- ---------------------------------------------------------------------------
drop policy if exists companies_select on public.companies;
drop policy if exists companies_insert on public.companies;
drop policy if exists companies_update on public.companies;
create policy companies_select on public.companies
  for select to authenticated using (public.is_superadmin());
create policy companies_insert on public.companies
  for insert to authenticated with check (public.is_superadmin());
create policy companies_update on public.companies
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists products_select on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;
create policy products_select on public.products
  for select to authenticated using (public.shop_readable(company_id));
create policy products_insert on public.products
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy products_update on public.products
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));
create policy products_delete on public.products
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists users_select on public.users;
drop policy if exists users_insert on public.users;
drop policy if exists users_update on public.users;
drop policy if exists users_delete on public.users;
create policy users_select on public.users
  for select to authenticated
  using (role <> 'superadmin' and public.shop_readable(company_id));
create policy users_insert on public.users
  for insert to authenticated
  with check (
    role in ('cashier', 'admin', 'device')
    and public.is_admin()
    and public.shop_writable(company_id)
  );
create policy users_update on public.users
  for update to authenticated
  using (role <> 'superadmin' and public.is_admin() and public.shop_readable(company_id))
  with check (
    role in ('cashier', 'admin', 'device')
    and public.is_admin()
    and public.shop_writable(company_id)
  );
create policy users_delete on public.users
  for delete to authenticated
  using (role <> 'superadmin' and public.is_admin() and public.shop_writable(company_id));

drop policy if exists sales_select on public.sales;
drop policy if exists sales_insert on public.sales;
drop policy if exists sales_update on public.sales;
create policy sales_select on public.sales
  for select to authenticated using (public.shop_readable(company_id));
create policy sales_insert on public.sales
  for insert to authenticated
  with check (
    public.current_app_role() in ('device', 'admin')
    and public.shop_writable(company_id)
  );
create policy sales_update on public.sales
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));

drop policy if exists sale_items_select on public.sale_items;
drop policy if exists sale_items_insert on public.sale_items;
create policy sale_items_select on public.sale_items
  for select to authenticated using (public.shop_readable(company_id));
create policy sale_items_insert on public.sale_items
  for insert to authenticated
  with check (
    public.current_app_role() in ('device', 'admin')
    and public.shop_writable(company_id)
  );

drop policy if exists inventory_movements_select on public.inventory_movements;
drop policy if exists inventory_movements_insert on public.inventory_movements;
create policy inventory_movements_select on public.inventory_movements
  for select to authenticated using (public.shop_readable(company_id));
create policy inventory_movements_insert on public.inventory_movements
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));

drop policy if exists categories_select on public.categories;
drop policy if exists categories_insert on public.categories;
drop policy if exists categories_update on public.categories;
drop policy if exists categories_delete on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (public.shop_readable(company_id));
create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy categories_update on public.categories
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));
create policy categories_delete on public.categories
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists customers_select on public.customers;
drop policy if exists customers_insert on public.customers;
drop policy if exists customers_update on public.customers;
drop policy if exists customers_delete on public.customers;
create policy customers_select on public.customers
  for select to authenticated using (public.shop_readable(company_id));
create policy customers_insert on public.customers
  for insert to authenticated
  with check (
    public.current_app_role() in ('device', 'admin')
    and public.shop_writable(company_id)
  );
create policy customers_update on public.customers
  for update to authenticated
  using (
    public.current_app_role() in ('device', 'admin')
    and public.shop_readable(company_id)
  )
  with check (
    public.current_app_role() in ('device', 'admin')
    and public.shop_writable(company_id)
  );
create policy customers_delete on public.customers
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists store_settings_select on public.store_settings;
drop policy if exists store_settings_update on public.store_settings;
create policy store_settings_select on public.store_settings
  for select to authenticated using (public.shop_readable(company_id));
create policy store_settings_update on public.store_settings
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));

drop policy if exists receipt_layout_select on public.receipt_layout;
drop policy if exists receipt_layout_update on public.receipt_layout;
create policy receipt_layout_select on public.receipt_layout
  for select to authenticated using (public.shop_readable(company_id));
create policy receipt_layout_update on public.receipt_layout
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));

drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_update on public.expenses;
drop policy if exists expenses_delete on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (public.is_admin() and public.shop_readable(company_id));
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy expenses_update on public.expenses
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));
create policy expenses_delete on public.expenses
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists suppliers_select on public.suppliers;
drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
drop policy if exists suppliers_delete on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated
  using (public.is_admin() and public.shop_readable(company_id));
create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));
create policy suppliers_delete on public.suppliers
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists supplier_products_select on public.supplier_products;
drop policy if exists supplier_products_insert on public.supplier_products;
drop policy if exists supplier_products_delete on public.supplier_products;
create policy supplier_products_select on public.supplier_products
  for select to authenticated
  using (public.is_admin() and public.shop_readable(company_id));
create policy supplier_products_insert on public.supplier_products
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy supplier_products_delete on public.supplier_products
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists purchase_orders_select on public.purchase_orders;
drop policy if exists purchase_orders_insert on public.purchase_orders;
drop policy if exists purchase_orders_update on public.purchase_orders;
drop policy if exists purchase_orders_delete on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders
  for select to authenticated
  using (public.is_admin() and public.shop_readable(company_id));
create policy purchase_orders_insert on public.purchase_orders
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy purchase_orders_update on public.purchase_orders
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));
create policy purchase_orders_delete on public.purchase_orders
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists purchase_order_items_select on public.purchase_order_items;
drop policy if exists purchase_order_items_insert on public.purchase_order_items;
drop policy if exists purchase_order_items_update on public.purchase_order_items;
drop policy if exists purchase_order_items_delete on public.purchase_order_items;
create policy purchase_order_items_select on public.purchase_order_items
  for select to authenticated
  using (public.is_admin() and public.shop_readable(company_id));
create policy purchase_order_items_insert on public.purchase_order_items
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy purchase_order_items_update on public.purchase_order_items
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));
create policy purchase_order_items_delete on public.purchase_order_items
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

drop policy if exists purchase_order_payments_select on public.purchase_order_payments;
drop policy if exists purchase_order_payments_insert on public.purchase_order_payments;
drop policy if exists purchase_order_payments_update on public.purchase_order_payments;
drop policy if exists purchase_order_payments_delete on public.purchase_order_payments;
create policy purchase_order_payments_select on public.purchase_order_payments
  for select to authenticated
  using (public.is_admin() and public.shop_readable(company_id));
create policy purchase_order_payments_insert on public.purchase_order_payments
  for insert to authenticated
  with check (public.is_admin() and public.shop_writable(company_id));
create policy purchase_order_payments_update on public.purchase_order_payments
  for update to authenticated
  using (public.is_admin() and public.shop_readable(company_id))
  with check (public.is_admin() and public.shop_writable(company_id));
create policy purchase_order_payments_delete on public.purchase_order_payments
  for delete to authenticated
  using (public.is_admin() and public.shop_writable(company_id));

-- ---------------------------------------------------------------------------
-- 11. Security-definer RPCs / triggers that bypass RLS — stamp + filter company
-- ---------------------------------------------------------------------------
create or replace function public.verify_pin(p_user_id uuid, p_pin text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored text;
  candidate text;
begin
  if public.current_app_role() is distinct from 'device'
     and public.current_app_role() is distinct from 'admin' then
    return false;
  end if;

  if not public.company_is_active() then
    return false;
  end if;

  if p_pin is null or length(p_pin) < 4 or length(p_pin) > 6 or p_pin !~ '^\d+$' then
    return false;
  end if;

  select u.pin_hash
    into stored
    from public.users u
   where u.id = p_user_id
     and u.is_active
     and u.role in ('cashier', 'admin')
     and u.company_id = public.current_company_id();

  if stored is null then
    return false;
  end if;

  candidate := encode(
    sha256(convert_to('double-a-pin:' || p_user_id::text || ':' || p_pin, 'UTF8')),
    'hex'
  );

  return candidate = stored;
end;
$$;

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
     and u.company_id = public.current_company_id()
     and public.company_is_active()
     and public.current_app_role() in ('device', 'admin');
$$;

create or replace function public.patch_sale_flags(
  p_id uuid,
  p_is_paid boolean,
  p_delivery_completed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_app_role() not in ('device', 'admin') then
    raise exception 'not allowed to patch sale flags';
  end if;
  if not public.company_is_active() then
    raise exception 'company is disabled';
  end if;

  update public.sales
     set is_paid = p_is_paid,
         delivery_completed = p_delivery_completed,
         updated_at = now()
   where id = p_id
     and company_id = public.current_company_id();

  if not found then
    raise exception 'sale not found';
  end if;
end;
$$;

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set stock_quantity = stock_quantity + new.change_quantity,
         updated_at = now()
   where id = new.product_id
     and company_id = new.company_id;

  if not found then
    raise exception 'product not found for this company';
  end if;

  return new;
end;
$$;

create or replace function public.log_sale_item_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if new.product_id is null then
    return new;
  end if;

  v_company_id := coalesce(
    new.company_id,
    (select s.company_id from public.sales s where s.id = new.sale_id)
  );

  insert into public.inventory_movements
    (product_id, change_quantity, reason, reference_id, company_id)
  values
    (new.product_id, -new.quantity, 'sale', new.sale_id, v_company_id);

  return new;
end;
$$;

create or replace function public.restore_stock_on_void()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'voided' and coalesce(old.status, '') <> 'voided' then
    insert into public.inventory_movements
      (product_id, change_quantity, reason, reference_id, note, company_id)
    select si.product_id,
           si.quantity,
           'void_restore',
           new.id,
           'sale voided',
           new.company_id
      from public.sale_items si
     where si.sale_id = new.id
       and si.product_id is not null;
  end if;

  return new;
end;
$$;

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_change_quantity numeric,
  p_reason text,
  p_note text default null,
  p_created_by uuid default null,
  p_reference_id uuid default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.products;
  v_company_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if not public.company_is_active() then
    raise exception 'company is disabled';
  end if;

  if p_change_quantity = 0 then
    raise exception 'change_quantity must not be zero';
  end if;

  if p_reason not in ('restock', 'adjustment', 'oversell_correction') then
    raise exception 'reason must be restock, adjustment or oversell_correction';
  end if;

  select p.company_id into v_company_id
    from public.products p
   where p.id = p_product_id;

  if v_company_id is null or v_company_id is distinct from public.current_company_id() then
    raise exception 'product not found';
  end if;

  insert into public.inventory_movements
    (product_id, change_quantity, reason, note, created_by, reference_id, company_id)
  values
    (p_product_id, p_change_quantity, p_reason, p_note, p_created_by, p_reference_id, v_company_id);

  select * into updated from public.products where id = p_product_id;
  return updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Reports: filter to current company (definer bypasses RLS)
-- ---------------------------------------------------------------------------
create or replace function public.report_profit(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  bucket date,
  sales_count bigint,
  items_sold bigint,
  revenue numeric,
  discount numeric,
  cost numeric,
  gross_profit numeric,
  margin_percent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
    select (s.created_at at time zone public.store_timezone())::date,
           count(distinct s.id),
           coalesce(sum(si.quantity), 0)::bigint,
           coalesce(sum(si.subtotal), 0),
           coalesce(sum((si.list_price - si.unit_price) * si.quantity), 0),
           coalesce(sum(si.unit_cost * si.quantity), 0),
           coalesce(sum(si.subtotal - si.unit_cost * si.quantity), 0),
           case
             when coalesce(sum(si.subtotal), 0) = 0 then 0
             else round(
               sum(si.subtotal - si.unit_cost * si.quantity) / sum(si.subtotal) * 100,
               2
             )
           end
      from public.sales s
      join public.sale_items si on si.sale_id = s.id
     where s.status = 'completed'
       and s.company_id = public.current_company_id()
       and s.created_at >= p_from
       and s.created_at < p_to
     group by 1
     order by 1;
end;
$$;

create or replace function public.report_top_products(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 20
)
returns table (
  product_id uuid,
  product_name text,
  category text,
  quantity_sold bigint,
  revenue numeric,
  cost numeric,
  gross_profit numeric,
  margin_percent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
    select si.product_id,
           max(si.product_name),
           max(p.category),
           sum(si.quantity)::bigint,
           sum(si.subtotal),
           sum(si.unit_cost * si.quantity),
           sum(si.subtotal - si.unit_cost * si.quantity),
           case
             when sum(si.subtotal) = 0 then 0
             else round(sum(si.subtotal - si.unit_cost * si.quantity) / sum(si.subtotal) * 100, 2)
           end
      from public.sale_items si
      join public.sales s on s.id = si.sale_id
      left join public.products p on p.id = si.product_id
     where s.status = 'completed'
       and s.company_id = public.current_company_id()
       and s.created_at >= p_from
       and s.created_at < p_to
     group by si.product_id
     order by sum(si.subtotal - si.unit_cost * si.quantity) desc
     limit greatest(p_limit, 1);
end;
$$;

drop function if exists public.report_discounts(timestamptz, timestamptz);

create or replace function public.report_discounts(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  sale_id uuid,
  sold_at timestamptz,
  cashier_name text,
  device_id text,
  product_name text,
  quantity numeric,
  list_price numeric,
  unit_price numeric,
  discount_total numeric,
  discount_percent numeric,
  below_cost boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
    select s.id,
           s.created_at,
           u.name,
           s.device_id,
           si.product_name,
           si.quantity,
           si.list_price,
           si.unit_price,
           (si.list_price - si.unit_price) * si.quantity,
           case
             when si.list_price = 0 then 0
             else round((si.list_price - si.unit_price) / si.list_price * 100, 2)
           end,
           si.unit_price < si.unit_cost
      from public.sale_items si
      join public.sales s on s.id = si.sale_id
      left join public.users u on u.id = s.user_id
     where s.status = 'completed'
       and s.company_id = public.current_company_id()
       and si.unit_price < si.list_price
       and s.created_at >= p_from
       and s.created_at < p_to
     order by (si.list_price - si.unit_price) * si.quantity desc;
end;
$$;

grant execute on function public.report_discounts(timestamptz, timestamptz) to authenticated;

create or replace function public.report_by_cashier(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  user_id uuid,
  cashier_name text,
  sales_count bigint,
  revenue numeric,
  discount numeric,
  gross_profit numeric,
  average_sale numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
    with per_sale as (
      select s.id,
             s.user_id as cashier_id,
             sum(si.subtotal) as sale_revenue,
             sum((si.list_price - si.unit_price) * si.quantity) as sale_discount,
             sum(si.subtotal - si.unit_cost * si.quantity) as sale_profit
        from public.sales s
        join public.sale_items si on si.sale_id = s.id
       where s.status = 'completed'
         and s.company_id = public.current_company_id()
         and s.created_at >= p_from
         and s.created_at < p_to
       group by s.id, s.user_id
    )
    select per_sale.cashier_id,
           coalesce(u.name, 'Unknown'),
           count(*),
           sum(per_sale.sale_revenue),
           sum(per_sale.sale_discount),
           sum(per_sale.sale_profit),
           round(avg(per_sale.sale_revenue), 2)
      from per_sale
      left join public.users u on u.id = per_sale.cashier_id
     group by per_sale.cashier_id, u.name
     order by sum(per_sale.sale_revenue) desc;
end;
$$;

create or replace function public.report_by_device(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  device_id text,
  sales_count bigint,
  revenue numeric,
  gross_profit numeric,
  last_sale_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
    with per_sale as (
      select s.id,
             coalesce(s.device_id, 'unknown') as terminal,
             s.created_at as sold_at,
             sum(si.subtotal) as sale_revenue,
             sum(si.subtotal - si.unit_cost * si.quantity) as sale_profit
        from public.sales s
        join public.sale_items si on si.sale_id = s.id
       where s.status = 'completed'
         and s.company_id = public.current_company_id()
         and s.created_at >= p_from
         and s.created_at < p_to
       group by s.id, s.device_id, s.created_at
    )
    select per_sale.terminal,
           count(*),
           sum(per_sale.sale_revenue),
           sum(per_sale.sale_profit),
           max(per_sale.sold_at)
      from per_sale
     group by per_sale.terminal
     order by sum(per_sale.sale_revenue) desc;
end;
$$;

create or replace function public.report_inventory_valuation()
returns table (
  product_id uuid,
  product_name text,
  sku text,
  category text,
  unit text,
  stock_quantity numeric,
  cost_price numeric,
  price numeric,
  cost_value numeric,
  retail_value numeric,
  potential_profit numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
    select p.id,
           p.name,
           p.sku,
           p.category,
           p.unit,
           p.stock_quantity,
           p.cost_price,
           p.price,
           round(p.cost_price * greatest(p.stock_quantity, 0), 2),
           round(p.price * greatest(p.stock_quantity, 0), 2),
           round((p.price - p.cost_price) * greatest(p.stock_quantity, 0), 2)
      from public.products p
     where p.is_active
       and p.company_id = public.current_company_id()
     order by p.cost_price * greatest(p.stock_quantity, 0) desc;
end;
$$;

create or replace function public.report_dead_stock(p_days integer default 60)
returns table (
  product_id uuid,
  product_name text,
  sku text,
  category text,
  stock_quantity numeric,
  cost_value numeric,
  last_sold_at timestamptz,
  days_since_sale integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return query
    with last_sale as (
      select si.product_id as pid, max(s.created_at) as sold_at
        from public.sale_items si
        join public.sales s on s.id = si.sale_id
       where s.status = 'completed'
         and s.company_id = public.current_company_id()
       group by si.product_id
    )
    select p.id,
           p.name,
           p.sku,
           p.category,
           p.stock_quantity,
           round(p.cost_price * greatest(p.stock_quantity, 0), 2),
           last_sale.sold_at,
           case
             when last_sale.sold_at is null then null
             else extract(day from now() - last_sale.sold_at)::integer
           end
      from public.products p
      left join last_sale on last_sale.pid = p.id
     where p.is_active
       and p.company_id = public.current_company_id()
       and p.stock_quantity > 0
       and (
         last_sale.sold_at is null
         or last_sale.sold_at < now() - make_interval(days => greatest(p_days, 1))
       )
     order by p.cost_price * greatest(p.stock_quantity, 0) desc;
end;
$$;

-- Views owned by the migration role bypass RLS unless security_invoker.
drop view if exists public.oversold_products;
create view public.oversold_products
with (security_invoker = true) as
select p.id,
       p.name,
       p.sku,
       p.stock_quantity,
       abs(p.stock_quantity) as oversold_by
  from public.products p
 where p.stock_quantity < 0;

drop view if exists public.stock_reconciliation;
create view public.stock_reconciliation
with (security_invoker = true) as
select p.id,
       p.name,
       p.stock_quantity,
       coalesce(sum(m.change_quantity), 0) as movement_total,
       p.stock_quantity - coalesce(sum(m.change_quantity), 0) as drift
  from public.products p
  left join public.inventory_movements m on m.product_id = p.id
 group by p.id, p.name, p.stock_quantity
having p.stock_quantity <> coalesce(sum(m.change_quantity), 0);

drop view if exists public.products_below_reorder;
create view public.products_below_reorder
with (security_invoker = true) as
select p.id,
       p.name,
       p.sku,
       p.category,
       p.unit,
       p.stock_quantity,
       p.reorder_point,
       p.reorder_point - p.stock_quantity as short_by,
       p.cost_price,
       round(p.cost_price * greatest(p.reorder_point - p.stock_quantity, 0), 2) as restock_cost
  from public.products p
 where p.is_active
   and p.stock_quantity <= p.reorder_point;

grant select on public.oversold_products to authenticated;
grant select on public.stock_reconciliation to authenticated;
grant select on public.products_below_reorder to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Platform stats — superadmin only, ignores acting company
-- ---------------------------------------------------------------------------
create or replace function public.company_stats()
returns table (
  id uuid,
  name text,
  is_active boolean,
  created_at timestamptz,
  product_count bigint,
  category_count bigint,
  supplier_count bigint,
  customer_count bigint,
  sale_count bigint,
  user_count bigint,
  stock_units numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;

  return query
    select c.id,
           c.name,
           c.is_active,
           c.created_at,
           (select count(*) from public.products p where p.company_id = c.id),
           (select count(*) from public.categories cat where cat.company_id = c.id),
           (select count(*) from public.suppliers s where s.company_id = c.id),
           (select count(*) from public.customers cu where cu.company_id = c.id),
           (select count(*) from public.sales sa where sa.company_id = c.id and sa.status = 'completed'),
           (select count(*) from public.users u where u.company_id = c.id),
           (select coalesce(sum(p.stock_quantity), 0) from public.products p where p.company_id = c.id)
      from public.companies c
     order by c.created_at;
end;
$$;

revoke all on function public.company_stats() from public;
grant execute on function public.company_stats() to authenticated;
grant execute on function public.company_stats() to service_role;

grant select, insert, update on public.companies to authenticated;
