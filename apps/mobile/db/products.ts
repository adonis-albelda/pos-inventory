import {
  isProductUnit,
  type Product,
  type ProductUnit,
  type ProductWithEstimatedStock,
} from "@double-a/shared-types";
import { getDb } from "./index";

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost_price: number;
  stock_quantity: number;
  category: string | null;
  category_id: string | null;
  unit: string;
  barcode: string | null;
  reorder_point: number;
  bulk_price: number | null;
  bulk_min_quantity: number | null;
  is_active: number;
  updated_at: string | null;
  pending_quantity: number;
}

/** A device a version behind the office can hold a unit this build does not know. */
function toUnit(value: string): ProductUnit {
  return isProductUnit(value) ? value : "pc";
}

function toProductWithEstimate(row: ProductRow): ProductWithEstimatedStock {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    price: row.price,
    costPrice: row.cost_price,
    stockQuantity: row.stock_quantity,
    category: row.category,
    categoryId: row.category_id,
    unit: toUnit(row.unit),
    barcode: row.barcode,
    reorderPoint: row.reorder_point,
    bulkPrice: row.bulk_price,
    bulkMinQuantity: row.bulk_min_quantity,
    isActive: row.is_active === 1,
    updatedAt: row.updated_at ?? "",
    pendingQuantity: row.pending_quantity,
    estimatedStock: row.stock_quantity - row.pending_quantity,
  };
}

/**
 * Estimated stock is computed here, at read time, never stored:
 *
 *   estimated = last synced stock - everything sold locally but not yet pushed
 *
 * It is a display estimate. The real number lives in Supabase and comes back on
 * the next pull.
 */
const SELECT_SQL = `
SELECT p.id,
       p.name,
       p.sku,
       p.price,
       p.cost_price,
       p.stock_quantity,
       p.category,
       p.category_id,
       p.unit,
       p.barcode,
       p.reorder_point,
       p.bulk_price,
       p.bulk_min_quantity,
       p.is_active,
       p.updated_at,
       COALESCE((
         SELECT SUM(si.quantity)
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
          WHERE si.product_id = p.id
            AND s.sync_status = 'pending'
            AND s.status = 'completed'
       ), 0) AS pending_quantity
  FROM products p
`;

const LIST_SQL = `${SELECT_SQL} WHERE p.is_active = 1 ORDER BY p.name`;

const BY_BARCODE_SQL = `${SELECT_SQL}
  WHERE p.is_active = 1 AND (p.barcode = ? OR p.sku = ?)
  LIMIT 1`;

export async function listLocalProducts(): Promise<ProductWithEstimatedStock[]> {
  const rows = await getDb().getAllAsync<ProductRow>(LIST_SQL);
  return rows.map(toProductWithEstimate);
}

/**
 * Exact barcode or SKU match, for a scanner (or a QR printed from the SKU).
 * Equality only — a partial match would put the wrong product in the cart.
 */
export async function findLocalProductByBarcode(
  code: string,
): Promise<ProductWithEstimatedStock | null> {
  const needle = code.trim();
  if (!needle) return null;

  const row = await getDb().getFirstAsync<ProductRow>(BY_BARCODE_SQL, needle, needle);
  return row ? toProductWithEstimate(row) : null;
}

/**
 * Name, SKU or barcode. A scanned code is an exact hit and jumps to the front,
 * ahead of anything that merely contains the typed text.
 */
export async function searchLocalProducts(
  term: string,
): Promise<ProductWithEstimatedStock[]> {
  const products = await listLocalProducts();
  const needle = term.trim().toLowerCase();
  if (!needle) return products;

  const matches = products.filter(
    (product) =>
      product.name.toLowerCase().includes(needle) ||
      (product.sku ?? "").toLowerCase().includes(needle) ||
      (product.barcode ?? "").toLowerCase().includes(needle),
  );

  const exactIndex = matches.findIndex(
    (product) => (product.barcode ?? "").toLowerCase() === needle,
  );
  if (exactIndex <= 0) return matches;

  const exact = matches[exactIndex];
  return exact
    ? [exact, ...matches.filter((_, index) => index !== exactIndex)]
    : matches;
}

/** Overwrites local rows with what the pull returned. Supabase wins, always. */
export async function upsertProducts(products: Product[]): Promise<void> {
  if (products.length === 0) return;

  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const product of products) {
      await db.runAsync(
        `INSERT INTO products
           (id, name, sku, price, cost_price, stock_quantity, category, category_id,
            unit, barcode, reorder_point, bulk_price, bulk_min_quantity, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name,
           sku = excluded.sku,
           price = excluded.price,
           cost_price = excluded.cost_price,
           stock_quantity = excluded.stock_quantity,
           category = excluded.category,
           category_id = excluded.category_id,
           unit = excluded.unit,
           barcode = excluded.barcode,
           reorder_point = excluded.reorder_point,
           bulk_price = excluded.bulk_price,
           bulk_min_quantity = excluded.bulk_min_quantity,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at`,
        product.id,
        product.name,
        product.sku,
        product.price,
        product.costPrice,
        product.stockQuantity,
        product.category,
        product.categoryId,
        product.unit,
        product.barcode,
        product.reorderPoint,
        product.bulkPrice,
        product.bulkMinQuantity,
        product.isActive ? 1 : 0,
        product.updatedAt,
      );
    }
  });
}

/**
 * How each product on a sale is sold by, for receipts and the sale detail
 * screen. Sale lines snapshot prices, not the unit — "m" or "bag" is a property
 * of the product and does not change under a completed sale.
 */
export async function getProductUnits(
  productIds: string[],
): Promise<Map<string, ProductUnit>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await getDb().getAllAsync<{ id: string; unit: string }>(
    `SELECT id, unit FROM products WHERE id IN (${placeholders})`,
    ...ids,
  );

  return new Map(rows.map((row) => [row.id, toUnit(row.unit)]));
}

export async function countLocalProducts(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM products",
  );
  return row?.count ?? 0;
}
