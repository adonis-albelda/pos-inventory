-- Who the shop is: the name and logo on the POS header, the address and phone a
-- customer reads off a receipt.
--
-- One row, forever. The primary key is a boolean pinned to true, so a second
-- row is rejected by the key itself rather than by an application rule nobody
-- can see. Devices pull this row on every sync like any other master data, and
-- write it never — the office owns it.

create table public.store_settings (
  id boolean primary key default true check (id),
  name text not null default 'DOUBLE A',
  -- Public URL in the store-logos bucket. Null until the owner uploads one, and
  -- a device that has never been online cannot fetch it either way, so every
  -- surface falls back to the name.
  logo_url text,
  address text,
  phone text,
  -- Printed under the total. Empty means the receipt keeps its default footer.
  receipt_footer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger store_settings_touch_updated_at
  before update on public.store_settings
  for each row execute function public.touch_updated_at();

-- Seeded here rather than by the first save, so admin and every device always
-- read a row and never have to handle "no settings yet".
insert into public.store_settings (id) values (true);

alter table public.store_settings enable row level security;

-- Everyone authenticated reads: a terminal pulls this to draw its header.
create policy store_settings_select on public.store_settings
  for select to authenticated using (true);

create policy store_settings_update on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- No insert or delete policy on purpose. The single row is seeded above and
-- there is no version of this table with none or two.

-- ---------------------------------------------------------------------------
-- Logo storage
--
-- Public bucket: the URL ends up on a POS header and, eventually, a receipt, so
-- it has to be fetchable without a session. Writes stay admin-only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

create policy store_logos_read on storage.objects
  for select to public using (bucket_id = 'store-logos');

create policy store_logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-logos' and public.is_admin());

create policy store_logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'store-logos' and public.is_admin())
  with check (bucket_id = 'store-logos' and public.is_admin());

create policy store_logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-logos' and public.is_admin());
