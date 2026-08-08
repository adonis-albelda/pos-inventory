-- Per-line note on a purchase order item: the owner's remark on a single
-- product on the order (substitution asked for, damaged on arrival, back-order
-- promised, etc). Snapshot text like the payment-term note — admin-only, never
-- read by a POS terminal.
alter table public.purchase_order_items
  add column note text check (note is null or length(note) <= 500);
