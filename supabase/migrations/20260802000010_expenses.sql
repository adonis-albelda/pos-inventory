-- Operating expenses the owner records in admin. Not COGS (that lives on
-- sale_items.unit_cost) and never written from a POS terminal. Dashboard and
-- reports subtract the sum from revenue for the same shop-day range.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null
    check (length(trim(description)) > 0 and length(description) <= 200),
  amount numeric(12, 2) not null check (amount > 0),
  -- Free-text bucket (rent, wages, utilities…). Null is fine — not every
  -- outlay needs a label for the ledger to still add up.
  category text check (category is null or length(category) <= 80),
  -- Shop calendar day in Asia/Manila, not the insert timestamp. An owner
  -- entering yesterday's electric bill must land on yesterday's P&L.
  expense_date date not null default ((timezone('Asia/Manila', now()))::date),
  note text check (note is null or length(note) <= 500),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_date_idx on public.expenses (expense_date desc);
create index expenses_category_idx
  on public.expenses (lower(category))
  where category is not null;

create trigger expenses_touch_updated_at
  before update on public.expenses
  for each row execute function public.touch_updated_at();

alter table public.expenses enable row level security;

-- Owner-only. A cashier session must not see or edit the books.
create policy expenses_select on public.expenses
  for select to authenticated using (public.is_admin());

create policy expenses_insert on public.expenses
  for insert to authenticated with check (public.is_admin());

create policy expenses_update on public.expenses
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy expenses_delete on public.expenses
  for delete to authenticated using (public.is_admin());
