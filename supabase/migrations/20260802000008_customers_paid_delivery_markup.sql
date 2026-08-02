-- Customers as reusable records, category markup, and sale paid/fulfillment flags.
--
-- 1. customers — linked from sales via customer_id. Devices create rows offline
--    with their own UUIDs (same rule as sales). Snapshot text on sales stays so
--    a receipt still reads after a customer rename.
-- 2. categories gain an optional markup % applied when creating products.
-- 3. sales gain is_paid, fulfillment, delivery_completed. Cash is paid at the
--    counter; GCash/card need a later manual mark. Delivery is a separate flag
--    from "customer details filled in".

-- ---------------------------------------------------------------------------
-- 1. Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0 and length(name) <= 160),
  address text check (address is null or length(address) <= 160),
  contact text check (contact is null or length(contact) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_name_idx on public.customers (lower(name));
create index customers_updated_at_idx on public.customers (updated_at);
create index customers_contact_idx
  on public.customers (lower(contact))
  where contact is not null;

create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

alter table public.sales
  add column customer_id uuid references public.customers (id) on delete set null;

create index sales_customer_id_idx
  on public.sales (customer_id)
  where customer_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Category markup — shelf = cost × (1 + percent/100) when applied
-- ---------------------------------------------------------------------------
alter table public.categories
  add column markup_percent numeric(6, 2) not null default 0
    check (markup_percent >= 0 and markup_percent <= 9999.99),
  add column markup_applied boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. Paid + fulfillment on sales
-- ---------------------------------------------------------------------------
alter table public.sales
  add column is_paid boolean not null default true,
  add column fulfillment text not null default 'pickup'
    check (fulfillment in ('pickup', 'delivery')),
  add column delivery_completed boolean not null default false;

-- Open deliveries: the POS Delivery tab and admin filters.
create index sales_open_delivery_idx
  on public.sales (created_at desc)
  where fulfillment = 'delivery' and delivery_completed = false and status = 'completed';

create index sales_unpaid_idx
  on public.sales (created_at desc)
  where is_paid = false and status = 'completed';

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;

create policy customers_select on public.customers
  for select to authenticated using (true);

create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.current_app_role() in ('device', 'admin'));

create policy customers_update on public.customers
  for update to authenticated
  using (public.current_app_role() in ('device', 'admin'))
  with check (public.current_app_role() in ('device', 'admin'));

create policy customers_delete on public.customers
  for delete to authenticated using (public.is_admin());

-- Devices may patch paid / delivery flags on sales they already pushed.
-- ignoreDuplicates on insert cannot update those columns, so this RPC is the
-- only write path for a later mark-paid or mark-delivered from the POS.
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

  update public.sales
     set is_paid = p_is_paid,
         delivery_completed = p_delivery_completed,
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.patch_sale_flags(uuid, boolean, boolean) from public;
grant execute on function public.patch_sale_flags(uuid, boolean, boolean) to authenticated;
