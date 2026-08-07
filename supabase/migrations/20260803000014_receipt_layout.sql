-- Receipt layout the owner edits in admin. Terminals pull it whole on every
-- sync (same pattern as store_settings / categories) and never write it.
-- Bluetooth pairing stays on-device — each terminal pairs its own PT-210.

create table public.receipt_layout (
  id boolean primary key default true check (id),
  show_shop_name boolean not null default true,
  show_address boolean not null default true,
  show_phone boolean not null default true,
  -- Thermal paper cannot show a logo image without a separate bitmap path;
  -- when on, the receipt prints a short "[logo]" stand-in under the shop name
  -- so the owner can see where a mark would sit. Real logo printing can come later.
  show_logo_line boolean not null default false,
  show_cashier boolean not null default true,
  show_terminal boolean not null default true,
  show_customer boolean not null default true,
  show_discounts boolean not null default true,
  show_payment boolean not null default true,
  show_footer boolean not null default true,
  -- PT-210 is 58mm; 32 columns is the ESC/POS character budget for that roll.
  paper_width_mm integer not null default 58 check (paper_width_mm = 58),
  columns integer not null default 32 check (columns = 32),
  printer_model text not null default 'PT-210',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger receipt_layout_touch_updated_at
  before update on public.receipt_layout
  for each row execute function public.touch_updated_at();

insert into public.receipt_layout (id) values (true);

alter table public.receipt_layout enable row level security;

-- Devices pull the layout so offline printing matches the office template.
create policy receipt_layout_select on public.receipt_layout
  for select to authenticated using (true);

create policy receipt_layout_update on public.receipt_layout
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
