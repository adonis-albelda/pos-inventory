-- Server-side inventory math. The mobile app never writes stock_quantity —
-- it only ever sends sale events up, and this is what turns them into stock.
--
-- Single writer rule: products.stock_quantity is only ever changed by
-- apply_inventory_movement(). Everything that wants to move stock inserts an
-- inventory_movements row. That keeps stock_quantity equal to the sum of a
-- product's movements, which makes reconciliation a one-line query.

-- ---------------------------------------------------------------------------
-- 1. A movement row is the thing that changes stock.
-- ---------------------------------------------------------------------------
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
   where id = new.product_id;

  return new;
end;
$$;

create trigger inventory_movements_apply
  after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- ---------------------------------------------------------------------------
-- 2. A sale line item logs a negative movement.
--    Fires on insert only, so a retried push that upserts with
--    ignoreDuplicates cannot decrement the same line twice.
-- ---------------------------------------------------------------------------
create or replace function public.log_sale_item_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is null then
    return new;
  end if;

  insert into public.inventory_movements
    (product_id, change_quantity, reason, reference_id)
  values
    (new.product_id, -new.quantity, 'sale', new.sale_id);

  return new;
end;
$$;

create trigger sale_items_log_movement
  after insert on public.sale_items
  for each row execute function public.log_sale_item_movement();

-- ---------------------------------------------------------------------------
-- 3. Voiding a sale puts the stock back.
-- ---------------------------------------------------------------------------
create or replace function public.restore_stock_on_void()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'voided' and coalesce(old.status, '') <> 'voided' then
    insert into public.inventory_movements
      (product_id, change_quantity, reason, reference_id, note)
    select si.product_id,
           si.quantity,
           'void_restore',
           new.id,
           'sale voided'
      from public.sale_items si
     where si.sale_id = new.id
       and si.product_id is not null;
  end if;

  return new;
end;
$$;

create trigger sales_restore_stock_on_void
  after update of status on public.sales
  for each row execute function public.restore_stock_on_void();

-- ---------------------------------------------------------------------------
-- 4. Admin-facing helpers.
-- ---------------------------------------------------------------------------

-- Oversold products: stock went below zero because two offline devices both
-- sold the last unit. Surfaced for manual resolution, not prevented.
create or replace view public.oversold_products as
select p.id,
       p.name,
       p.sku,
       p.stock_quantity,
       abs(p.stock_quantity) as oversold_by
  from public.products p
 where p.stock_quantity < 0;

-- Reconciliation: stock_quantity should always equal the sum of movements.
-- A non-empty result means something wrote stock outside the movement log.
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

-- Restock / manual adjustment entry point for the admin dashboard.
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_change_quantity integer,
  p_reason text,
  p_note text default null,
  p_created_by uuid default null
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
    (product_id, change_quantity, reason, note, created_by)
  values
    (p_product_id, p_change_quantity, p_reason, p_note, p_created_by);

  select * into updated from public.products where id = p_product_id;
  return updated;
end;
$$;
