-- Hardware-store specifics: what a thing cost us, what it is sold by, and what
-- it actually sold for after the attendant negotiated at the counter.
--
-- Three ideas here, in order:
--   1. Categories become a tree, because "Plumbing / Pipes / PVC" is how a
--      hardware store thinks. products.category is kept as the flattened path
--      so every existing query, the receipt, and the POS keep working.
--   2. Products gain a supplier cost and the shape of how they are sold: unit
--      of measure, barcode, reorder point, and a bulk price for contractors.
--   3. Sale lines record three prices, not one: what it lists at, what it sold
--      at, and what it cost us. Profit is then arithmetic on a single row and
--      never moves when a supplier changes their price next month.

-- ---------------------------------------------------------------------------
-- 1. Nested categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  parent_id uuid references public.categories (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Two siblings cannot share a name. Roots are compared against a fixed
-- sentinel because null is never equal to null in a unique index.
create unique index categories_sibling_name_idx
  on public.categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index categories_parent_idx on public.categories (parent_id);
create index categories_updated_at_idx on public.categories (updated_at);

create trigger categories_touch_updated_at
  before update on public.categories
  for each row execute function public.touch_updated_at();

-- The full path, e.g. 'Plumbing / Pipes / PVC'. Depth is capped so a bad edit
-- cannot spin here forever.
create or replace function public.category_path(p_category_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  with recursive climb as (
    select c.id, c.name, c.parent_id, 1 as depth
      from public.categories c
     where c.id = p_category_id
    union all
    select parent.id, parent.name, parent.parent_id, climb.depth + 1
      from public.categories parent
      join climb on climb.parent_id = parent.id
     where climb.depth < 6
  )
  select string_agg(name, ' / ' order by depth desc) from climb;
$$;

-- A category may not sit under itself, at any depth.
create or replace function public.reject_category_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cursor_id uuid := new.parent_id;
  hops integer := 0;
begin
  while cursor_id is not null and hops < 10 loop
    if cursor_id = new.id then
      raise exception 'a category cannot be nested inside itself';
    end if;

    select parent_id into cursor_id from public.categories where id = cursor_id;
    hops := hops + 1;
  end loop;

  return new;
end;
$$;

create trigger categories_reject_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.reject_category_cycle();

-- ---------------------------------------------------------------------------
-- 2. Products: cost, how it is sold, and when to reorder
-- ---------------------------------------------------------------------------
alter table public.products
  add column category_id uuid references public.categories (id) on delete set null,
  -- What we pay the supplier. The owner's margin is price - cost_price, and
  -- every report in 20260801000005_reports.sql hangs off this one column.
  add column cost_price numeric(10, 2) not null default 0 check (cost_price >= 0),
  add column unit text not null default 'pc'
    check (unit in ('pc', 'box', 'set', 'pack', 'roll', 'sheet', 'm', 'ft', 'kg', 'l', 'gal', 'bag')),
  add column barcode text,
  -- Below this, the product shows up on the reorder report. Per product,
  -- because a box of screws and a length of GI pipe run out very differently.
  add column reorder_point integer not null default 5 check (reorder_point >= 0),
  -- Contractor pricing: at or above bulk_min_quantity, the POS offers
  -- bulk_price instead of price. Null bulk_price means no bulk tier.
  add column bulk_price numeric(10, 2) check (bulk_price >= 0),
  add column bulk_min_quantity integer check (bulk_min_quantity > 1),
  add constraint products_bulk_pair_ck check (
    (bulk_price is null and bulk_min_quantity is null)
    or (bulk_price is not null and bulk_min_quantity is not null)
  );

create unique index products_barcode_idx on public.products (barcode) where barcode is not null;
create index products_category_id_idx on public.products (category_id);
create index products_reorder_idx on public.products (stock_quantity) where is_active;

-- products.category stays populated with the flattened path, so the mobile
-- app, the receipt, and the existing admin queries never learn about the tree.
create or replace function public.set_product_category_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is not null then
    new.category := public.category_path(new.category_id);
  end if;

  return new;
end;
$$;

create trigger products_set_category_path
  before insert or update of category_id on public.products
  for each row execute function public.set_product_category_path();

-- Renaming or re-parenting a category rewrites the path on every product
-- underneath it.
create or replace function public.repath_products_on_category_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name or new.parent_id is distinct from old.parent_id then
    with recursive subtree as (
      select new.id as id
      union all
      select c.id from public.categories c join subtree s on c.parent_id = s.id
    )
    update public.products p
       set category = public.category_path(p.category_id),
           updated_at = now()
     where p.category_id in (select id from subtree);
  end if;

  return new;
end;
$$;

create trigger categories_repath_products
  after update on public.categories
  for each row execute function public.repath_products_on_category_change();

-- ---------------------------------------------------------------------------
-- 3. Sale lines: list price, sold price, and cost
-- ---------------------------------------------------------------------------
alter table public.sale_items
  -- The shelf price at the moment of sale. unit_price is what the customer
  -- actually paid, so list_price - unit_price is the attendant's discount.
  add column list_price numeric(10, 2) not null default 0 check (list_price >= 0),
  -- Snapshotted, never joined back to products for reporting. A supplier price
  -- change must not rewrite last quarter's profit.
  add column unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0);

alter table public.sales
  add column discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0);

-- A device that is a version behind sends neither list_price nor unit_cost.
-- Fill both from the product rather than reporting a 100% margin.
create or replace function public.backfill_sale_item_prices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is null then
    new.list_price := coalesce(nullif(new.list_price, 0), new.unit_price);
    return new;
  end if;

  if new.list_price = 0 then
    select coalesce(p.price, new.unit_price) into new.list_price
      from public.products p where p.id = new.product_id;
  end if;

  if new.unit_cost = 0 then
    select coalesce(p.cost_price, 0) into new.unit_cost
      from public.products p where p.id = new.product_id;
  end if;

  return new;
end;
$$;

create trigger sale_items_backfill_prices
  before insert on public.sale_items
  for each row execute function public.backfill_sale_item_prices();

-- ---------------------------------------------------------------------------
-- 4. RLS for the new table
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;

create policy categories_select on public.categories
  for select using (true);

create policy categories_insert on public.categories
  for insert with check (public.is_admin());

create policy categories_update on public.categories
  for update using (public.is_admin()) with check (public.is_admin());

create policy categories_delete on public.categories
  for delete using (public.is_admin());
