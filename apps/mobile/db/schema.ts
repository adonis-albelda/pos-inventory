/**
 * The local SQLite schema.
 *
 * This database is a disposable working copy of Supabase, not a second source
 * of truth. Products and users are overwritten on every pull. Sales are the one
 * thing created here first, and they are pushed up before anything is pulled
 * down.
 *
 * Because sales live here before they live anywhere else, the schema is versioned
 * as an ordered list of steps rather than one script. A terminal that has been
 * selling all day through a bad connection must come out of an app update with
 * every pending sale still on it, so no step may drop or rebuild a table that
 * holds one. Additive `ALTER TABLE ... ADD COLUMN` only.
 */

export interface Migration {
  version: number;
  /** Run as one statement batch inside a single transaction. */
  sql: string;
}

/**
 * v1 is the original schema, still written with IF NOT EXISTS so a device that
 * predates the version list lands on its feet.
 */
const V1_INITIAL = `
-- Mirrors Supabase. stock_quantity is the last synced value and is never
-- decremented locally; the cashier sees an estimate computed at read time.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  price REAL NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'cashier',
  pin_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

-- Created here, pushed up. id is a UUID generated on this device.
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  total_amount REAL NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  device_id TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
);

-- Single row.
--
-- Two timestamps, doing two different jobs:
--   last_synced_at   — when this device last finished a sync, for the
--                      "Last synced: X ago" indicator.
--   high_water_mark  — the newest updated_at the server has handed over, used
--                      to filter the next incremental pull. Server time, so a
--                      wrong device clock cannot make a pull skip rows.
CREATE TABLE IF NOT EXISTS sync_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_synced_at TEXT,
  high_water_mark TEXT,
  first_pull_done INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sales_sync_status_idx ON sales (sync_status);
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON sales (created_at DESC);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_id_idx ON sale_items (product_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON products (is_active);

INSERT OR IGNORE INTO sync_meta (id, last_synced_at, high_water_mark, first_pull_done)
VALUES (1, NULL, NULL, 0);
`;

/**
 * v2 mirrors the hardware-store columns Supabase gained: what a thing cost us,
 * what it is sold by, and what a line actually sold for against its list price.
 *
 * Every column is added with a default, so rows already on the device — pending
 * sales above all — keep their data and simply acquire a sensible value. The
 * defaults match the server's: an unsynced sale written before this upgrade
 * reports no discount and zero cost, and the `sale_items_backfill_prices`
 * trigger fills the real list price and cost in when it finally arrives.
 */
const V2_HARDWARE_COLUMNS = `
ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'pc';
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN reorder_point INTEGER NOT NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN bulk_price REAL;
ALTER TABLE products ADD COLUMN bulk_min_quantity INTEGER;
ALTER TABLE products ADD COLUMN category_id TEXT;

ALTER TABLE sale_items ADD COLUMN list_price REAL NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0;

ALTER TABLE sales ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS products_barcode_idx ON products (barcode);
`;

/**
 * v3 gives the POS the category tree itself, rather than inferring it from the
 * flattened path text on each product. A product keeps its path text forever —
 * that is what a receipt printed months ago says — so deleting a category in
 * the office leaves that text behind on every product under it. Reading the
 * strip off those paths meant retired shelves never went away.
 *
 * The rows here are replaced whole on every pull, which is also how a deletion
 * reaches the device: an incremental query cannot return a row that is gone.
 */
const V3_CATEGORIES = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories (parent_id);
`;

/**
 * v4 carries the optional customer details a counter can attach to a sale.
 *
 * Nullable with no default, which is the point: a sale written before this
 * upgrade — including one still sitting here unpushed — reads back as a sale
 * nobody was asked about, which is exactly what it was.
 */
const V4_SALE_CUSTOMER = `
ALTER TABLE sales ADD COLUMN customer_name TEXT;
ALTER TABLE sales ADD COLUMN customer_address TEXT;
ALTER TABLE sales ADD COLUMN customer_contact TEXT;
`;

/**
 * v5 holds who the shop is, so the header carries the real name and logo rather
 * than a constant compiled into the app.
 *
 * Single row, like sync_meta, and seeded with the same default the server
 * migration uses — a terminal that has not pulled yet still has a header to
 * draw. Replaced whole on every pull; nothing on the device ever writes it.
 */
const V5_STORE_SETTINGS = `
CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'DOUBLE A',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  receipt_footer TEXT,
  updated_at TEXT
);

INSERT OR IGNORE INTO store_settings (id) VALUES (1);
`;

/** Ordered, append-only. Never edit a step that has shipped. */
export const MIGRATIONS: Migration[] = [
  { version: 1, sql: V1_INITIAL },
  { version: 2, sql: V2_HARDWARE_COLUMNS },
  { version: 3, sql: V3_CATEGORIES },
  { version: 4, sql: V4_SALE_CUSTOMER },
  { version: 5, sql: V5_STORE_SETTINGS },
];

export const SCHEMA_VERSION = MIGRATIONS.reduce(
  (highest, step) => Math.max(highest, step.version),
  0,
);
