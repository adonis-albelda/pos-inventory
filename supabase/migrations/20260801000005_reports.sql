-- Reporting for the owner. All of it is SQL, none of it is a client-side
-- reduce over a fetched page — a report must see every row in the range, not
-- the first 300.
--
-- Rules that hold for every function here:
--   * Admin only, checked before the query runs, so a non-admin gets an error
--     rather than an empty report.
--   * Profit always comes from sale_items.unit_cost, the cost snapshotted at
--     the time of sale, never from the product's cost today.
--   * Voided sales are excluded everywhere. A void is not a sale.
--   * Days are bucketed in store local time, so "today" ends at midnight in
--     the shop, not at midnight UTC.

create or replace function public.store_timezone()
returns text
language sql
immutable
as $$ select 'Asia/Manila'::text $$;

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
end;
$$;

-- ---------------------------------------------------------------------------
-- Profit and margin, one row per day
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
       and s.created_at >= p_from
       and s.created_at < p_to
     group by 1
     order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Top products, by profit and by volume
-- ---------------------------------------------------------------------------
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
           -- The name as sold. A product renamed since then still reports
           -- under the name on the receipt the customer holds.
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
       and s.created_at >= p_from
       and s.created_at < p_to
     group by si.product_id
     order by sum(si.subtotal - si.unit_cost * si.quantity) desc
     limit greatest(p_limit, 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Discount audit: every counter negotiation, and what it cost
-- ---------------------------------------------------------------------------
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
  quantity integer,
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
       and si.unit_price < si.list_price
       and s.created_at >= p_from
       and s.created_at < p_to
     order by (si.list_price - si.unit_price) * si.quantity desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who sold it: per cashier and per terminal
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- What is sitting on the shelves
-- ---------------------------------------------------------------------------
create or replace function public.report_inventory_valuation()
returns table (
  product_id uuid,
  product_name text,
  sku text,
  category text,
  unit text,
  stock_quantity integer,
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

-- Dead stock: on the shelf, tying up money, not moving.
create or replace function public.report_dead_stock(p_days integer default 60)
returns table (
  product_id uuid,
  product_name text,
  sku text,
  category text,
  stock_quantity integer,
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

-- Reorder list. A plain view, because the POS "low stock" badge and the admin
-- reorder report must agree on what "low" means.
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

grant execute on function public.report_profit(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_top_products(timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.report_discounts(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_by_cashier(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_by_device(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_inventory_valuation() to authenticated;
grant execute on function public.report_dead_stock(integer) to authenticated;
