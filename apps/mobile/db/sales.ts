import * as Crypto from "expo-crypto";
import {
  cartDiscount,
  cartTotal,
  lineSubtotal,
  normaliseCustomerDetails,
  roundMoney,
  type CartLine,
  type CustomerDetails,
  type LocalSale,
  type LocalSaleWithItems,
  type PaymentMethod,
  type SaleItem,
} from "@double-a/shared-types";
import { getDb } from "./index";

interface SaleRow {
  id: string;
  user_id: string | null;
  total_amount: number;
  discount_amount: number | null;
  payment_method: string | null;
  status: string;
  device_id: string | null;
  created_at: string;
  customer_name: string | null;
  customer_address: string | null;
  customer_contact: string | null;
  sync_status: string;
  synced_at: string | null;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  list_price: number | null;
  unit_cost: number | null;
  subtotal: number;
}

function toLocalSale(row: SaleRow): LocalSale {
  return {
    id: row.id,
    userId: row.user_id,
    totalAmount: row.total_amount,
    discountAmount: row.discount_amount ?? 0,
    paymentMethod: row.payment_method as PaymentMethod | null,
    status: row.status as LocalSale["status"],
    deviceId: row.device_id,
    createdAt: row.created_at,
    // Null on every sale nobody was asked about, and on every sale written
    // before the columns existed. Both mean the same thing.
    customerName: row.customer_name,
    customerAddress: row.customer_address,
    customerContact: row.customer_contact,
    syncStatus: row.sync_status as LocalSale["syncStatus"],
    syncedAt: row.synced_at,
  };
}

/**
 * A sale written before the hardware-store columns existed has a zero list
 * price. Reading it back as the price paid keeps the receipt honest — it shows
 * no discount rather than claiming the whole line was given away.
 */
function toLocalSaleItem(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    listPrice: row.list_price ? row.list_price : row.unit_price,
    unitCost: row.unit_cost ?? 0,
    subtotal: row.subtotal,
  };
}

export interface CompleteSaleInput {
  lines: CartLine[];
  userId: string;
  deviceId: string;
  paymentMethod: PaymentMethod;
  /** Optional throughout. Omit it entirely for a walk-in. */
  customer?: CustomerDetails;
}

/**
 * Writes a sale and its line items in one local transaction and returns
 * immediately. No network call, online or off — the cashier must never wait on
 * connectivity to finish a sale or print a receipt.
 *
 * Both the sale id and every line item id are UUIDs generated here. The line
 * item ids matter as much as the sale id: the push upserts on them, which is
 * what stops a retried push from decrementing stock twice server-side.
 */
export async function completeSale(
  input: CompleteSaleInput,
): Promise<LocalSaleWithItems> {
  const db = getDb();

  const saleId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const total = cartTotal(input.lines);
  // What the counter gave away, recorded on the sale so the office can report on
  // it without re-deriving it from every line.
  const discount = cartDiscount(input.lines);
  // Normalised here rather than trusting the sheet, so the row that goes to
  // Supabase is already trimmed and within the length the server checks. A
  // rejected row would hold up the whole batch of pending sales.
  const customer = normaliseCustomerDetails(input.customer ?? {});

  const items: SaleItem[] = input.lines.map((line) => ({
    id: Crypto.randomUUID(),
    saleId,
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    unitPrice: roundMoney(line.unitPrice),
    listPrice: roundMoney(line.listPrice),
    unitCost: roundMoney(line.unitCost),
    subtotal: lineSubtotal(line.unitPrice, line.quantity),
  }));

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sales
         (id, user_id, total_amount, discount_amount, payment_method, status, device_id, created_at,
          customer_name, customer_address, customer_contact, sync_status)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, 'pending')`,
      saleId,
      input.userId,
      total,
      discount,
      input.paymentMethod,
      input.deviceId,
      createdAt,
      customer.name,
      customer.address,
      customer.contact,
    );

    for (const item of items) {
      await db.runAsync(
        `INSERT INTO sale_items
           (id, sale_id, product_id, product_name, quantity, unit_price, list_price, unit_cost, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.saleId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.listPrice,
        item.unitCost,
        item.subtotal,
      );
    }
  });

  return {
    id: saleId,
    userId: input.userId,
    totalAmount: total,
    discountAmount: discount,
    paymentMethod: input.paymentMethod,
    status: "completed",
    deviceId: input.deviceId,
    createdAt,
    customerName: customer.name,
    customerAddress: customer.address,
    customerContact: customer.contact,
    syncStatus: "pending",
    syncedAt: null,
    items,
  };
}

export async function getLocalSale(
  saleId: string,
): Promise<LocalSaleWithItems | null> {
  const db = getDb();
  const sale = await db.getFirstAsync<SaleRow>(
    "SELECT * FROM sales WHERE id = ?",
    saleId,
  );
  if (!sale) return null;

  const items = await db.getAllAsync<SaleItemRow>(
    "SELECT * FROM sale_items WHERE sale_id = ?",
    saleId,
  );

  return { ...toLocalSale(sale), items: items.map(toLocalSaleItem) };
}

export async function listLocalSales(
  limit = 100,
): Promise<LocalSaleWithItems[]> {
  const db = getDb();
  const sales = await db.getAllAsync<SaleRow>(
    "SELECT * FROM sales ORDER BY created_at DESC LIMIT ?",
    limit,
  );
  if (sales.length === 0) return [];

  const placeholders = sales.map(() => "?").join(", ");
  const items = await db.getAllAsync<SaleItemRow>(
    `SELECT * FROM sale_items WHERE sale_id IN (${placeholders})`,
    ...sales.map((sale) => sale.id),
  );

  const bySale = new Map<string, SaleItem[]>();
  for (const row of items) {
    const list = bySale.get(row.sale_id) ?? [];
    list.push(toLocalSaleItem(row));
    bySale.set(row.sale_id, list);
  }

  return sales.map((sale) => ({
    ...toLocalSale(sale),
    items: bySale.get(sale.id) ?? [],
  }));
}

/** What the push step uploads. */
export async function listPendingSales(): Promise<LocalSaleWithItems[]> {
  const db = getDb();
  const sales = await db.getAllAsync<SaleRow>(
    "SELECT * FROM sales WHERE sync_status = 'pending' ORDER BY created_at",
  );
  if (sales.length === 0) return [];

  const placeholders = sales.map(() => "?").join(", ");
  const items = await db.getAllAsync<SaleItemRow>(
    `SELECT * FROM sale_items WHERE sale_id IN (${placeholders})`,
    ...sales.map((sale) => sale.id),
  );

  const bySale = new Map<string, SaleItem[]>();
  for (const row of items) {
    const list = bySale.get(row.sale_id) ?? [];
    list.push(toLocalSaleItem(row));
    bySale.set(row.sale_id, list);
  }

  return sales.map((sale) => ({
    ...toLocalSale(sale),
    items: bySale.get(sale.id) ?? [],
  }));
}

export async function countPendingSales(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sales WHERE sync_status = 'pending'",
  );
  return row?.count ?? 0;
}

export async function markSalesSynced(
  saleIds: string[],
  syncedAt: string,
): Promise<void> {
  if (saleIds.length === 0) return;

  const db = getDb();
  const placeholders = saleIds.map(() => "?").join(", ");
  await db.runAsync(
    `UPDATE sales SET sync_status = 'synced', synced_at = ?
      WHERE id IN (${placeholders})`,
    syncedAt,
    ...saleIds,
  );
}

/**
 * Marks a failed push so the cashier can see it. Rows stay eligible for the
 * next attempt — a failed sale is never dropped.
 */
export async function markSalesFailed(saleIds: string[]): Promise<void> {
  if (saleIds.length === 0) return;

  const db = getDb();
  const placeholders = saleIds.map(() => "?").join(", ");
  await db.runAsync(
    `UPDATE sales SET sync_status = 'pending' WHERE id IN (${placeholders})`,
    ...saleIds,
  );
}

/**
 * A sale can only be voided on the device while it is still pending, in which
 * case it is deleted outright and never pushed.
 *
 * Once a sale has been pushed, voiding has to happen in the admin dashboard: the
 * server decrements stock when sale_items arrive, and only an UPDATE to
 * sales.status puts that stock back.
 */
export async function voidPendingSale(saleId: string): Promise<void> {
  const db = getDb();
  const sale = await db.getFirstAsync<{ sync_status: string }>(
    "SELECT sync_status FROM sales WHERE id = ?",
    saleId,
  );

  if (!sale) throw new Error("That sale is no longer on this device.");
  if (sale.sync_status !== "pending") {
    throw new Error(
      "This sale has already synced. Void it from the admin dashboard so stock goes back.",
    );
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM sale_items WHERE sale_id = ?", saleId);
    await db.runAsync("DELETE FROM sales WHERE id = ?", saleId);
  });
}

export interface LocalDaySummary {
  salesCount: number;
  revenue: number;
  itemsSold: number;
  pendingCount: number;
}

export async function summariseToday(): Promise<LocalDaySummary> {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();

  const db = getDb();
  const totals = await db.getFirstAsync<{
    sales_count: number;
    revenue: number | null;
    pending_count: number;
  }>(
    `SELECT COUNT(*) AS sales_count,
            SUM(total_amount) AS revenue,
            SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) AS pending_count
       FROM sales
      WHERE created_at >= ? AND status = 'completed'`,
    startOfDay,
  );

  const items = await db.getFirstAsync<{ items_sold: number | null }>(
    `SELECT SUM(si.quantity) AS items_sold
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
      WHERE s.created_at >= ? AND s.status = 'completed'`,
    startOfDay,
  );

  return {
    salesCount: totals?.sales_count ?? 0,
    revenue: roundMoney(totals?.revenue ?? 0),
    itemsSold: items?.items_sold ?? 0,
    pendingCount: totals?.pending_count ?? 0,
  };
}
