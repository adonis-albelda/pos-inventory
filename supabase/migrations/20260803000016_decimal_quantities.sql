-- Decimal quantities.
--
-- A hardware store sells wire by the metre, sand by the kilo and paint by the
-- litre — quantities that are not whole numbers. Until now every quantity column
-- was `integer`, which silently truncated a 2.5 kg sale to 2. This widens the
-- three quantity columns to numeric(12, 3) and adds a per-product flag that says
-- whether fractional quantities are allowed at all.
--
-- The flag defaults from the unit: the fractional units (m, ft, kg, l, gal, roll)
-- start life allowing decimals, everything else stays whole-number unless the
-- owner turns it on. Enforcement of "whole number only" lives in the app, not a
-- CHECK, so an existing integer never trips a constraint and a unit can be
-- reclassified without a migration.
--
-- DATA SAFETY: nothing here deletes or rewrites a row of business data. Postgres
-- refuses to change the type of a column a view or generated column reads, so the
-- views and functions that read stock_quantity / change_quantity, plus the
-- generated purchase_order_items.line_total, are dropped first and recreated
-- verbatim afterwards. Views, functions and generated columns are derived — they
-- hold no source data, so dropping and rebuilding them loses nothing. The base
-- tables themselves keep every row; integer -> numeric is a lossless widening.

-- ---------------------------------------------------------------------------
-- 0. Drop the derived objects that pin the column types. Recreated at the end.
--    `if exists` keeps the migration re-runnable after the earlier failed try.
-- ---------------------------------------------------------------------------
drop view if exists public.oversold_products;
drop view if exists public.stock_reconciliation;
drop view if exists public.products_below_reorder;

drop function if exists public.report_inventory_valuation();
drop function if exists public.report_dead_stock(integer);

-- Triggers whose event lists name a purchase_order_items quantity column pin its
-- type. Their functions stay; only the triggers are dropped and recreated.
drop trigger if exists purchase_order_items_recalc_total on public.purchase_order_items;
drop trigger if exists purchase_order_items_recalc_status on public.purchase_order_items;

-- ---------------------------------------------------------------------------
-- 1. Widen the quantity columns. Triggers do arithmetic only, so they are
--    unaffected — numeric + numeric is still numeric.
-- ---------------------------------------------------------------------------
alter table public.products
  alter column stock_quantity type numeric(12, 3);

alter table public.sale_items
  alter column quantity type numeric(12, 3);

alter table public.inventory_movements
  alter column change_quantity type numeric(12, 3);

-- purchase_order_items.line_total is a stored generated column over
-- quantity_ordered, so the column type cannot change while it exists. Drop it,
-- widen, then put it back with the same definition.
alter table public.purchase_order_items
  drop column line_total;

alter table public.purchase_order_items
  alter column quantity_ordered type numeric(12, 3);

alter table public.purchase_order_items
  alter column quantity_received type numeric(12, 3);

alter table public.purchase_order_items
  add column line_total numeric(12, 2)
    generated always as (quantity_ordered * unit_cost) stored;

-- Recreate the PO triggers verbatim from 20260803000013_purchase_orders.sql.
create trigger purchase_order_items_recalc_total
  after insert or delete or update of quantity_ordered, unit_cost
  on public.purchase_order_items
  for each row execute function public.recalc_purchase_order_total();

create trigger purchase_order_items_recalc_status
  after update of quantity_received on public.purchase_order_items
  for each row execute function public.recalc_purchase_order_status();

-- ---------------------------------------------------------------------------
-- 2. Per-product decimal flag, defaulted from the unit for existing rows.
-- ---------------------------------------------------------------------------
alter table public.products
  add column allow_decimal boolean not null default false;

update public.products
   set allow_decimal = true
 where unit in ('m', 'ft', 'kg', 'l', 'gal', 'roll');

-- ---------------------------------------------------------------------------
-- 3. adjust_stock takes a numeric change now. Parameter type change means
--    drop + recreate, same as when it gained a reference id.
-- ---------------------------------------------------------------------------
drop function if exists public.adjust_stock(uuid, integer, text, text, uuid, uuid);

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
begin
  if p_change_quantity = 0 then
    raise exception 'change_quantity must not be zero';
  end if;

  if p_reason not in ('restock', 'adjustment', 'oversell_correction') then
    raise exception 'reason must be restock, adjustment or oversell_correction';
  end if;

  insert into public.inventory_movements
    (product_id, change_quantity, reason, note, created_by, reference_id)
  values
    (p_product_id, p_change_quantity, p_reason, p_note, p_created_by, p_reference_id);

  select * into updated from public.products where id = p_product_id;
  return updated;
end;
$$;

grant execute on function public.adjust_stock(uuid, numeric, text, text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Recreate the dropped views verbatim from their original migrations, now
--    reading the widened numeric columns.
-- ---------------------------------------------------------------------------

-- From 20260801000002_inventory.sql
create or replace view public.oversold_products as
select p.id,
       p.name,
       p.sku,
       p.stock_quantity,
       abs(p.stock_quantity) as oversold_by
  from public.products p
 where p.stock_quantity < 0;

-- From 20260801000002_inventory.sql
create or replace view public.stock_reconciliation as
select p.id,
       p.name,
       p.stock_quantity,
       coalesce(sum(m.change_quantity), 0) as movement_total,
       p.stock_quantity - coalesce(sum(m.change_quantity), 0) as drift
  from public.products p
  left join public.inventory_movements m on m.product_id = p.id
 group by p.id, p.name, p.stock_quantity
having p.stock_quantity <> coalesce(sum(m.change_quantity), 0);

-- From 20260801000005_reports.sql
create or replace view public.products_below_reorder as
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

-- ---------------------------------------------------------------------------
-- 5. Recreate the two report functions, widening their stock_quantity return
--    column to numeric so decimal stock is reported in full, not truncated.
--    Bodies are unchanged from 20260801000005_reports.sql.
-- ---------------------------------------------------------------------------
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
       and p.stock_quantity > 0
       and (
         last_sale.sold_at is null
         or last_sale.sold_at < now() - make_interval(days => greatest(p_days, 1))
       )
     order by p.cost_price * greatest(p.stock_quantity, 0) desc;
end;
$$;

grant execute on function public.report_inventory_valuation() to authenticated;
grant execute on function public.report_dead_stock(integer) to authenticated;
