-- Optional customer details on a sale: who it was for, where it goes, how to
-- reach them.
--
-- Three plain text columns, all nullable, and nullable is the normal case. A
-- walk-in buying a bag of cement is never asked. They are filled for a delivery
-- or for a contractor who needs the sale under their name.
--
-- Deliberately not a link to a customer table:
--   * There is no customer table, and adding one would put a foreign key on the
--     one row a device creates entirely offline. A sale has to be complete and
--     valid before it has ever spoken to the server.
--   * A receipt printed today should still read the same in a year. Snapshotted
--     text cannot be rewritten by an edit to a customer record later, the same
--     reason sale_items snapshot product_name and unit_cost.
--
-- Length is capped so a mistaken paste cannot bloat a sync payload. The device
-- trims and truncates before writing, so the check is a backstop, not the
-- validation — a rejection here would fail a whole batch of pushed sales.
alter table public.sales
  add column customer_name text check (length(customer_name) <= 160),
  add column customer_address text check (length(customer_address) <= 160),
  add column customer_contact text check (length(customer_contact) <= 160);

-- Named sales are looked up by name from the office ("what did we sell to
-- Reyes?"), and only a minority of rows carry one, so the index covers just
-- those. Case-insensitive because nobody types a name the same way twice.
create index sales_customer_name_idx
  on public.sales (lower(customer_name))
  where customer_name is not null;

-- RLS needs nothing: the policies in 20260801000003_rls.sql are column-blind,
-- and these columns are written by the same device insert as the rest of the
-- sale.
