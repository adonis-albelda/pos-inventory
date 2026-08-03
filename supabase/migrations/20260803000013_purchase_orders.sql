-- Purchase orders: what the owner orders from a supplier, on what payment
-- terms, and whether each line actually showed up. Admin-only — this is not
-- part of the mobile sync contract (see AGENTS.md §1), the same tier as
-- expenses.

-- ---------------------------------------------------------------------------
-- suppliers — who the shop buys stock from
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0 and length(name) <= 200),
  contact_person text check (contact_person is null or length(contact_person) <= 120),
  phone text check (phone is null or length(phone) <= 40),
  email text check (email is null or length(email) <= 200),
  address text check (address is null or length(address) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_name_idx on public.suppliers (lower(name));
create index suppliers_active_idx on public.suppliers (is_active) where is_active;

create trigger suppliers_touch_updated_at
  before update on public.suppliers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- supplier_products — which products a supplier carries. A convenience link
-- for building a PO faster; a PO is never restricted to only these products.
-- ---------------------------------------------------------------------------
create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (supplier_id, product_id)
);

create index supplier_products_supplier_id_idx on public.supplier_products (supplier_id);
create index supplier_products_product_id_idx on public.supplier_products (product_id);

-- ---------------------------------------------------------------------------
-- purchase_orders — the header
-- ---------------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  -- Restrict, not cascade: a supplier with order history can be deactivated
  -- but never deleted out from under its own paper trail.
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  -- Shop calendar day in Asia/Manila, same reasoning as expenses.expense_date.
  order_date date not null default ((timezone('Asia/Manila', now()))::date),
  expected_date date,
  reference_no text check (reference_no is null or length(reference_no) <= 60),
  notes text check (notes is null or length(notes) <= 1000),
  -- Kept in sync by recalc_purchase_order_total() below — never hand-edited.
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_order_date_idx on public.purchase_orders (order_date desc);

create trigger purchase_orders_touch_updated_at
  before update on public.purchase_orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- purchase_order_items — lines. product_name/unit_cost are snapshots, same
-- reasoning as sale_items: a later product rename or deletion must not
-- corrupt an old PO. Received state is derived from the two quantities, not
-- stored: 0 = not received, 0 < received < ordered = partial, otherwise done.
-- ---------------------------------------------------------------------------
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0
    check (quantity_received >= 0 and quantity_received <= quantity_ordered),
  unit_cost numeric(10, 2) not null check (unit_cost >= 0),
  line_total numeric(12, 2) generated always as (quantity_ordered * unit_cost) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_order_items_po_id_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_product_id_idx on public.purchase_order_items (product_id);

create trigger purchase_order_items_touch_updated_at
  before update on public.purchase_order_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- purchase_order_payments — the installment terms. Supplier balance owed is
-- sum(amount) where not is_paid across a supplier's non-cancelled POs — a
-- query (see supplierBalance / sumSupplierBalance), never a stored column.
-- ---------------------------------------------------------------------------
create table public.purchase_order_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  term_number integer not null check (term_number > 0),
  due_date date,
  amount numeric(12, 2) not null check (amount > 0),
  is_paid boolean not null default false,
  paid_date date,
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, term_number)
);

create index purchase_order_payments_po_id_idx on public.purchase_order_payments (purchase_order_id);
create index purchase_order_payments_due_date_idx
  on public.purchase_order_payments (due_date)
  where not is_paid;

create trigger purchase_order_payments_touch_updated_at
  before update on public.purchase_order_payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Keep purchase_orders.total_amount equal to sum(line_total) at all times,
-- the same "single writer" spirit as apply_inventory_movement.
-- ---------------------------------------------------------------------------
create or replace function public.recalc_purchase_order_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  po_id uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  update public.purchase_orders
     set total_amount = coalesce(
           (select sum(line_total)
              from public.purchase_order_items
             where purchase_order_id = po_id),
           0
         )
   where id = po_id;

  return coalesce(new, old);
end;
$$;

create trigger purchase_order_items_recalc_total
  after insert or delete or update of quantity_ordered, unit_cost
  on public.purchase_order_items
  for each row execute function public.recalc_purchase_order_total();

-- ---------------------------------------------------------------------------
-- Receiving lines pushes a PO forward from ordered -> partially_received ->
-- received automatically. draft and cancelled are only ever set by an
-- explicit owner action, never by this trigger.
-- ---------------------------------------------------------------------------
create or replace function public.recalc_purchase_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_lines integer;
  fully_received_lines integer;
  received_lines integer;
  current_status text;
begin
  select status into current_status
    from public.purchase_orders
   where id = new.purchase_order_id;

  if current_status not in ('ordered', 'partially_received', 'received') then
    return new;
  end if;

  select count(*),
         count(*) filter (where quantity_received >= quantity_ordered),
         count(*) filter (where quantity_received > 0)
    into total_lines, fully_received_lines, received_lines
    from public.purchase_order_items
   where purchase_order_id = new.purchase_order_id;

  if total_lines > 0 and fully_received_lines = total_lines then
    update public.purchase_orders set status = 'received' where id = new.purchase_order_id;
  elsif received_lines > 0 then
    update public.purchase_orders set status = 'partially_received' where id = new.purchase_order_id;
  end if;

  return new;
end;
$$;

create trigger purchase_order_items_recalc_status
  after update of quantity_received on public.purchase_order_items
  for each row execute function public.recalc_purchase_order_status();

-- ---------------------------------------------------------------------------
-- RLS — owner-only across the board, same policy shape as expenses. None of
-- this is read by a POS terminal.
-- ---------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_payments enable row level security;

create policy suppliers_select on public.suppliers
  for select to authenticated using (public.is_admin());
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (public.is_admin());
create policy suppliers_update on public.suppliers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy suppliers_delete on public.suppliers
  for delete to authenticated using (public.is_admin());

create policy supplier_products_select on public.supplier_products
  for select to authenticated using (public.is_admin());
create policy supplier_products_insert on public.supplier_products
  for insert to authenticated with check (public.is_admin());
create policy supplier_products_delete on public.supplier_products
  for delete to authenticated using (public.is_admin());

create policy purchase_orders_select on public.purchase_orders
  for select to authenticated using (public.is_admin());
create policy purchase_orders_insert on public.purchase_orders
  for insert to authenticated with check (public.is_admin());
create policy purchase_orders_update on public.purchase_orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy purchase_orders_delete on public.purchase_orders
  for delete to authenticated using (public.is_admin());

create policy purchase_order_items_select on public.purchase_order_items
  for select to authenticated using (public.is_admin());
create policy purchase_order_items_insert on public.purchase_order_items
  for insert to authenticated with check (public.is_admin());
create policy purchase_order_items_update on public.purchase_order_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy purchase_order_items_delete on public.purchase_order_items
  for delete to authenticated using (public.is_admin());

create policy purchase_order_payments_select on public.purchase_order_payments
  for select to authenticated using (public.is_admin());
create policy purchase_order_payments_insert on public.purchase_order_payments
  for insert to authenticated with check (public.is_admin());
create policy purchase_order_payments_update on public.purchase_order_payments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy purchase_order_payments_delete on public.purchase_order_payments
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- adjust_stock gains an optional reference id, so receiving a PO line can
-- point its movement back at the order — same idea as a sale's reference_id.
-- Changing a parameter list requires drop + recreate, not just "or replace".
-- ---------------------------------------------------------------------------
drop function if exists public.adjust_stock(uuid, integer, text, text, uuid);

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_change_quantity integer,
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

grant execute on function public.adjust_stock(uuid, integer, text, text, uuid, uuid) to authenticated;
