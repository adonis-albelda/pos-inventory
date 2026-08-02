-- Seed 2 of 2 — hardware catalog: nested categories, products with supplier
-- cost, and opening stock.
--
-- Run 01_accounts.sql first. Safe to run more than once.
--
-- Stock still arrives only as inventory_movements. Setting products.stock_quantity
-- directly would still "work" and then show up forever as drift in the
-- stock_reconciliation view.

-- ---------------------------------------------------------------------------
-- 1. Category tree. Conflict target is (parent, lower(name)), so re-running
--    renames nothing and never duplicates a sibling.
-- ---------------------------------------------------------------------------
with roots as (
  insert into public.categories (id, name, parent_id)
  values
    ('11111111-1111-4111-8111-111111111101', 'Plumbing',     null),
    ('11111111-1111-4111-8111-111111111102', 'Electrical',   null),
    ('11111111-1111-4111-8111-111111111103', 'Fasteners',    null),
    ('11111111-1111-4111-8111-111111111104', 'Paint',        null),
    ('11111111-1111-4111-8111-111111111105', 'Tools',        null),
    ('11111111-1111-4111-8111-111111111106', 'Building',     null)
  on conflict do nothing
  returning id
)
select count(*) from roots;

-- Children. Ids are fixed so products can reference them by id below.
insert into public.categories (id, name, parent_id)
values
  ('11111111-1111-4111-8111-111111111111', 'Pipes',        '11111111-1111-4111-8111-111111111101'),
  ('11111111-1111-4111-8111-111111111112', 'Fittings',     '11111111-1111-4111-8111-111111111101'),
  ('11111111-1111-4111-8111-111111111113', 'Valves',       '11111111-1111-4111-8111-111111111101'),
  ('11111111-1111-4111-8111-111111111121', 'Wire & Cable', '11111111-1111-4111-8111-111111111102'),
  ('11111111-1111-4111-8111-111111111122', 'Switches',     '11111111-1111-4111-8111-111111111102'),
  ('11111111-1111-4111-8111-111111111123', 'Lighting',     '11111111-1111-4111-8111-111111111102'),
  ('11111111-1111-4111-8111-111111111131', 'Screws',       '11111111-1111-4111-8111-111111111103'),
  ('11111111-1111-4111-8111-111111111132', 'Bolts & Nuts', '11111111-1111-4111-8111-111111111103'),
  ('11111111-1111-4111-8111-111111111141', 'Interior',     '11111111-1111-4111-8111-111111111104'),
  ('11111111-1111-4111-8111-111111111142', 'Exterior',     '11111111-1111-4111-8111-111111111104'),
  ('11111111-1111-4111-8111-111111111151', 'Hand Tools',   '11111111-1111-4111-8111-111111111105'),
  ('11111111-1111-4111-8111-111111111152', 'Power Tools',  '11111111-1111-4111-8111-111111111105'),
  ('11111111-1111-4111-8111-111111111161', 'Cement',       '11111111-1111-4111-8111-111111111106'),
  ('11111111-1111-4111-8111-111111111162', 'Lumber',       '11111111-1111-4111-8111-111111111106')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Products. Conflict target is sku. category_id is the real link; the
--    products_set_category_path trigger fills products.category with the path.
--    cost_price is what the supplier charges us — the owner's margin hangs off
--    it. Bulk price is set on the contractor-friendly SKUs only.
-- ---------------------------------------------------------------------------
insert into public.products
  (name, sku, barcode, price, cost_price, unit, reorder_point,
   bulk_price, bulk_min_quantity, category_id, is_active)
values
  -- Plumbing / Pipes
  ('PVC pipe 1/2" x 3m',      'PVC-HALF-3M',  '4801234567001',  85.00,  52.00, 'pc',  20, null,   null, '11111111-1111-4111-8111-111111111111', true),
  ('PVC pipe 1" x 3m',        'PVC-1IN-3M',   '4801234567002', 145.00,  90.00, 'pc',  15, null,   null, '11111111-1111-4111-8111-111111111111', true),
  ('GI pipe 1/2" x 6m',       'GI-HALF-6M',   '4801234567003', 420.00, 280.00, 'pc',  10, null,   null, '11111111-1111-4111-8111-111111111111', true),
  -- Plumbing / Fittings
  ('PVC elbow 1/2"',          'PVC-ELB-HALF', '4801234567004',  12.00,   6.50, 'pc',  50,  10.00,   20, '11111111-1111-4111-8111-111111111112', true),
  ('PVC tee 1/2"',            'PVC-TEE-HALF', '4801234567005',  18.00,   9.00, 'pc',  40,  15.00,   20, '11111111-1111-4111-8111-111111111112', true),
  ('Teflon tape 1/2"',        'TEFLON-HALF',  '4801234567006',  15.00,   7.00, 'pc',  30, null,   null, '11111111-1111-4111-8111-111111111112', true),
  -- Plumbing / Valves
  ('Gate valve 1/2" brass',   'VALVE-GATE-H', '4801234567007', 185.00, 110.00, 'pc',  10, null,   null, '11111111-1111-4111-8111-111111111113', true),
  ('Ball valve 1/2" PVC',     'VALVE-BALL-H', '4801234567008',  95.00,  55.00, 'pc',  12, null,   null, '11111111-1111-4111-8111-111111111113', true),
  -- Electrical / Wire & Cable
  ('THHN wire #12 AWG',       'THHN-12',      '4801234567009',  28.00,  18.00, 'm', 100,  24.00,   50, '11111111-1111-4111-8111-111111111121', true),
  ('THHN wire #14 AWG',       'THHN-14',      '4801234567010',  18.00,  11.50, 'm', 100,  15.00,   50, '11111111-1111-4111-8111-111111111121', true),
  ('Electrical tape black',   'TAPE-ELEC',    '4801234567011',  25.00,  12.00, 'pc',  30, null,   null, '11111111-1111-4111-8111-111111111121', true),
  -- Electrical / Switches
  ('1-gang switch flush',     'SW-1GANG',     '4801234567012',  65.00,  35.00, 'pc',  20, null,   null, '11111111-1111-4111-8111-111111111122', true),
  ('2-gang outlet flush',     'OUT-2GANG',    '4801234567013',  85.00,  48.00, 'pc',  20, null,   null, '11111111-1111-4111-8111-111111111122', true),
  -- Electrical / Lighting
  ('LED bulb 9W daylight',    'LED-9W',       '4801234567014',  95.00,  55.00, 'pc',  25,  85.00,   10, '11111111-1111-4111-8111-111111111123', true),
  ('LED tube 18W T8',         'LED-T8-18',    '4801234567015', 180.00, 110.00, 'pc',  15, null,   null, '11111111-1111-4111-8111-111111111123', true),
  -- Fasteners / Screws
  ('Wood screw #8 x 1" (100)', 'SCR-W8-1',    '4801234567016',  45.00,  22.00, 'box', 15,  38.00,    5, '11111111-1111-4111-8111-111111111131', true),
  ('Tek screw 12mm (100)',    'SCR-TEK-12',   '4801234567017',  55.00,  28.00, 'box', 15,  48.00,    5, '11111111-1111-4111-8111-111111111131', true),
  -- Fasteners / Bolts & Nuts
  ('Hex bolt 3/8" x 2"',      'BOLT-38-2',    '4801234567018',  12.00,   5.50, 'pc',  50,  10.00,   25, '11111111-1111-4111-8111-111111111132', true),
  ('Hex nut 3/8"',            'NUT-38',       '4801234567019',   4.00,   1.50, 'pc', 100,   3.00,   50, '11111111-1111-4111-8111-111111111132', true),
  -- Paint
  ('Boysen latex white 4L',   'PAINT-LAT-W4', '4801234567020', 680.00, 420.00, 'pc',   8, null,   null, '11111111-1111-4111-8111-111111111141', true),
  ('Boysen acrylic enamel 1L','PAINT-ACR-1',  '4801234567021', 320.00, 195.00, 'pc',  10, null,   null, '11111111-1111-4111-8111-111111111142', true),
  ('Paint roller 9"',         'ROLLER-9',     '4801234567022',  85.00,  42.00, 'pc',  15, null,   null, '11111111-1111-4111-8111-111111111141', true),
  -- Tools
  ('Claw hammer 16oz',        'HAMMER-16',    '4801234567023', 280.00, 160.00, 'pc',   8, null,   null, '11111111-1111-4111-8111-111111111151', true),
  ('Adjustable wrench 10"',   'WRENCH-10',    '4801234567024', 350.00, 200.00, 'pc',   6, null,   null, '11111111-1111-4111-8111-111111111151', true),
  ('Stanley tape measure 5m', 'TAPE-5M',      '4801234567025', 185.00,  95.00, 'pc',  12, null,   null, '11111111-1111-4111-8111-111111111151', true),
  ('Bosch drill 13mm',        'DRILL-13',     '4801234567026', 3200.00,2100.00,'pc',   3, null,   null, '11111111-1111-4111-8111-111111111152', true),
  -- Building
  ('Portland cement 40kg',    'CEMENT-40',    '4801234567027', 265.00, 210.00, 'bag', 40, 250.00,   10, '11111111-1111-4111-8111-111111111161', true),
  ('Marine plywood 1/2" 4x8', 'PLY-HALF-48',  '4801234567028', 980.00, 720.00, 'sheet', 10, null, null, '11111111-1111-4111-8111-111111111162', true),
  ('Coco lumber 2x3 x 8ft',   'LUMBER-2X3',   '4801234567029',  95.00,  60.00, 'pc',  50,  85.00,   20, '11111111-1111-4111-8111-111111111162', true),
  ('Tie wire #16',            'TIEWIRE-16',   '4801234567030',  85.00,  52.00, 'kg',  20, null,   null, '11111111-1111-4111-8111-111111111161', true)
on conflict (sku) do update
   set name              = excluded.name,
       barcode           = excluded.barcode,
       price             = excluded.price,
       cost_price        = excluded.cost_price,
       unit              = excluded.unit,
       reorder_point     = excluded.reorder_point,
       bulk_price        = excluded.bulk_price,
       bulk_min_quantity = excluded.bulk_min_quantity,
       category_id       = excluded.category_id,
       is_active         = excluded.is_active;

-- ---------------------------------------------------------------------------
-- 3. Opening stock, as movements. Quantities vary by how fast each SKU turns
--    over — cement and wire come in by the pallet, a Bosch drill does not.
-- ---------------------------------------------------------------------------
insert into public.inventory_movements
  (product_id, change_quantity, reason, note, created_by)
select p.id,
       case p.sku
         when 'PVC-HALF-3M'  then 80
         when 'PVC-1IN-3M'   then 60
         when 'GI-HALF-6M'   then 40
         when 'PVC-ELB-HALF' then 200
         when 'PVC-TEE-HALF' then 150
         when 'TEFLON-HALF'  then 100
         when 'VALVE-GATE-H' then 30
         when 'VALVE-BALL-H' then 40
         when 'THHN-12'      then 500
         when 'THHN-14'      then 500
         when 'TAPE-ELEC'    then 80
         when 'SW-1GANG'     then 60
         when 'OUT-2GANG'    then 60
         when 'LED-9W'       then 100
         when 'LED-T8-18'    then 40
         when 'SCR-W8-1'     then 50
         when 'SCR-TEK-12'   then 50
         when 'BOLT-38-2'    then 200
         when 'NUT-38'       then 300
         when 'PAINT-LAT-W4' then 20
         when 'PAINT-ACR-1'  then 25
         when 'ROLLER-9'     then 40
         when 'HAMMER-16'    then 15
         when 'WRENCH-10'    then 12
         when 'TAPE-5M'      then 25
         when 'DRILL-13'     then 5
         when 'CEMENT-40'    then 100
         when 'PLY-HALF-48'  then 30
         when 'LUMBER-2X3'   then 120
         when 'TIEWIRE-16'   then 50
         else 50
       end,
       'restock',
       'opening stock (seed)',
       (select u.id
          from public.users u
         where u.role = 'admin'
         order by u.created_at
         limit 1)
  from public.products p
 where not exists (
   select 1
     from public.inventory_movements m
    where m.product_id = p.id
      and m.note = 'opening stock (seed)'
 );

-- Soft-retire the old grocery demo SKUs if this database was seeded before
-- the hardware cutover. They stay in history for any sale that referenced them.
update public.products
   set is_active = false
 where sku in (
   'RICE-5KG', 'OIL-1L', 'NOODLE-01', 'SARD-155', 'SUGAR-1KG',
   'WATER-500', 'SOFT-15', 'COFFEE-3N1', 'SOAP-BAR', 'SPONGE-01'
 );

-- ---------------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------------
select p.category,
       p.name,
       p.sku,
       p.unit,
       p.price,
       p.cost_price,
       round((p.price - p.cost_price) / nullif(p.price, 0) * 100, 1) as margin_pct,
       p.stock_quantity,
       p.reorder_point
  from public.products p
 order by p.category, p.name;

select * from public.stock_reconciliation;
select * from public.oversold_products;
select * from public.products_below_reorder;
