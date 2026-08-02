import {
  validateSaleForPush,
  type LocalSaleWithItems,
  type PushResult,
} from "@double-a/shared-types";
import {
  patchSaleFlags,
  pushCustomers,
  pushSales,
  type TablesInsert,
} from "@double-a/supabase";
import {
  listPendingCustomers,
  markCustomersSynced,
} from "@/db/customers";
import {
  listFlagPendingSales,
  listPendingSales,
  markFlagsSynced,
  markSalesSynced,
} from "@/db/sales";
import { getSupabase } from "@/lib/supabase";

const BATCH_SIZE = 50;

function toSaleInsert(sale: LocalSaleWithItems): TablesInsert<"sales"> {
  return {
    id: sale.id,
    user_id: sale.userId,
    total_amount: sale.totalAmount,
    discount_amount: sale.discountAmount,
    payment_method: sale.paymentMethod,
    status: sale.status,
    device_id: sale.deviceId,
    created_at: sale.createdAt,
    customer_id: sale.customerId,
    customer_name: sale.customerName,
    customer_address: sale.customerAddress,
    customer_contact: sale.customerContact,
    is_paid: sale.isPaid,
    fulfillment: sale.fulfillment,
    delivery_completed: sale.deliveryCompleted,
  };
}

/**
 * The three prices go up together. Sending them explicitly is what keeps the
 * server's backfill trigger idle: it only reaches for the product's current
 * price when a device a version behind sends zeros, and a supplier price change
 * would then rewrite the margin on a sale made weeks earlier.
 */
function toItemInserts(sale: LocalSaleWithItems): TablesInsert<"sale_items">[] {
  return sale.items.map((item) => ({
    id: item.id,
    sale_id: item.saleId,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    list_price: item.listPrice,
    unit_cost: item.unitCost,
    subtotal: item.subtotal,
  }));
}

/**
 * Step one of sync: local customers and sales up to Supabase.
 *
 * Customers first — sales.customer_id is a foreign key. Then new sales. Then
 * flag patches for sales that already landed but had paid/delivery flipped
 * later (ignoreDuplicates cannot update those columns).
 *
 * Rows are only marked synced after the upload for their batch succeeds. If the
 * connection drops halfway, whatever did not land stays pending and goes again
 * next time. Sync stops here on failure and never proceeds to the pull.
 */
export async function push(): Promise<PushResult> {
  const supabase = getSupabase();

  const pendingCustomers = await listPendingCustomers();
  if (pendingCustomers.length > 0) {
    await pushCustomers(
      supabase,
      pendingCustomers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        address: customer.address,
        contact: customer.contact,
        updated_at: customer.updatedAt || undefined,
      })),
    );
    await markCustomersSynced(pendingCustomers.map((customer) => customer.id));
  }

  const pending = await listPendingSales();

  // A malformed row would fail its whole batch, so bad rows are held back rather
  // than blocking every other sale on the device.
  const valid: LocalSaleWithItems[] = [];
  const rejected: { id: string; errors: string[] }[] = [];

  for (const sale of pending) {
    const result = validateSaleForPush(sale, sale.items);
    if (result.ok) valid.push(sale);
    else rejected.push({ id: sale.id, errors: result.errors });
  }

  if (rejected.length > 0) {
    console.warn("Sales held back from sync:", rejected);
  }

  let salesPushed = 0;
  let itemsPushed = 0;

  for (let index = 0; index < valid.length; index += BATCH_SIZE) {
    const batch = valid.slice(index, index + BATCH_SIZE);
    const saleRows = batch.map(toSaleInsert);
    const itemRows = batch.flatMap(toItemInserts);

    await pushSales(supabase, saleRows, itemRows);

    const syncedAt = new Date().toISOString();
    await markSalesSynced(
      batch.map((sale) => sale.id),
      syncedAt,
    );

    salesPushed += batch.length;
    itemsPushed += itemRows.length;
  }

  const flagPending = await listFlagPendingSales();
  for (const sale of flagPending) {
    await patchSaleFlags(supabase, sale.id, {
      isPaid: sale.isPaid,
      deliveryCompleted: sale.deliveryCompleted,
    });
  }
  await markFlagsSynced(flagPending.map((sale) => sale.id));

  if (rejected.length > 0 && salesPushed === 0 && pending.length > 0) {
    throw new Error(
      `${rejected.length} sale(s) could not be sent because their totals do not add up. Show this terminal to an admin.`,
    );
  }

  return { salesPushed, itemsPushed };
}
