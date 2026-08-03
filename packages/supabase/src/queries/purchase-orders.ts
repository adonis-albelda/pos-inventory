import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderPayment,
  PurchaseOrderStatus,
} from "@double-a/shared-types";
import { roundMoney } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate } from "../database.types";
import {
  toPurchaseOrder,
  toPurchaseOrderItem,
  toPurchaseOrderPayment,
} from "../mappers";
import { adjustStock } from "./inventory";

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  supplierName: string;
  items: PurchaseOrderItem[];
  payments: PurchaseOrderPayment[];
}

function splitPurchaseOrderRow(row: unknown): PurchaseOrderWithDetails {
  const {
    purchase_order_items: items,
    purchase_order_payments: payments,
    suppliers,
    ...po
  } = row as Record<string, unknown> & {
    purchase_order_items: Parameters<typeof toPurchaseOrderItem>[0][];
    purchase_order_payments: Parameters<typeof toPurchaseOrderPayment>[0][];
    suppliers: { name: string } | null;
  };

  return {
    ...toPurchaseOrder(po as Parameters<typeof toPurchaseOrder>[0]),
    supplierName: suppliers?.name ?? "—",
    items: (items ?? []).map(toPurchaseOrderItem),
    payments: (payments ?? []).map(toPurchaseOrderPayment),
  };
}

const PO_DETAIL_SELECT =
  "*, purchase_order_items(*), purchase_order_payments(*), suppliers(name)";

export interface PurchaseOrdersFilter {
  supplierId?: string;
  status?: PurchaseOrderStatus;
  limit?: number;
}

export async function listPurchaseOrders(
  client: DoubleAClient,
  filter: PurchaseOrdersFilter = {},
): Promise<PurchaseOrderWithDetails[]> {
  let query = client
    .from("purchase_orders")
    .select(PO_DETAIL_SELECT)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.supplierId) query = query.eq("supplier_id", filter.supplierId);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(splitPurchaseOrderRow);
}

export async function getPurchaseOrder(
  client: DoubleAClient,
  id: string,
): Promise<PurchaseOrderWithDetails | null> {
  const { data, error } = await client
    .from("purchase_orders")
    .select(PO_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? splitPurchaseOrderRow(data) : null;
}

export interface NewPurchaseOrderItem {
  productId: string | null;
  productName: string;
  quantityOrdered: number;
  unitCost: number;
}

export interface NewPurchaseOrderTerm {
  termNumber: number;
  dueDate: string | null;
  amount: number;
  note?: string | null;
}

/**
 * Header, then lines, then payment terms — same order as sales (header before
 * items, FK). Three sequential inserts, not one transaction: nothing else in
 * this codebase wraps a multi-table admin write either, and a header that
 * lands with no lines is still visible and editable, not silently lost.
 */
export async function createPurchaseOrder(
  client: DoubleAClient,
  input: {
    header: TablesInsert<"purchase_orders">;
    items: NewPurchaseOrderItem[];
    terms: NewPurchaseOrderTerm[];
  },
): Promise<PurchaseOrderWithDetails> {
  const { data: header, error: headerError } = await client
    .from("purchase_orders")
    .insert(input.header)
    .select("*")
    .single();
  if (headerError) throw headerError;

  if (input.items.length > 0) {
    const { error: itemsError } = await client.from("purchase_order_items").insert(
      input.items.map((item) => ({
        purchase_order_id: header.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity_ordered: item.quantityOrdered,
        unit_cost: item.unitCost,
      })),
    );
    if (itemsError) throw itemsError;
  }

  if (input.terms.length > 0) {
    const { error: termsError } = await client.from("purchase_order_payments").insert(
      input.terms.map((term) => ({
        purchase_order_id: header.id,
        term_number: term.termNumber,
        due_date: term.dueDate,
        amount: term.amount,
        note: term.note ?? null,
      })),
    );
    if (termsError) throw termsError;
  }

  const created = await getPurchaseOrder(client, header.id);
  if (!created) throw new Error("Purchase order was created but could not be reloaded");
  return created;
}

export async function updatePurchaseOrderHeader(
  client: DoubleAClient,
  id: string,
  patch: TablesUpdate<"purchase_orders">,
): Promise<PurchaseOrder> {
  const { data, error } = await client
    .from("purchase_orders")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toPurchaseOrder(data);
}

/** draft -> ordered, (draft | ordered | partially_received) -> cancelled. Receiving drives the rest. */
export async function setPurchaseOrderStatus(
  client: DoubleAClient,
  id: string,
  status: PurchaseOrderStatus,
): Promise<void> {
  const { error } = await client.from("purchase_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Draft-only editing — once ordered, lines are read-only except for receiving. */
export async function addPurchaseOrderItem(
  client: DoubleAClient,
  purchaseOrderId: string,
  item: NewPurchaseOrderItem,
): Promise<PurchaseOrderItem> {
  const { data, error } = await client
    .from("purchase_order_items")
    .insert({
      purchase_order_id: purchaseOrderId,
      product_id: item.productId,
      product_name: item.productName,
      quantity_ordered: item.quantityOrdered,
      unit_cost: item.unitCost,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toPurchaseOrderItem(data);
}

export async function updatePurchaseOrderItem(
  client: DoubleAClient,
  itemId: string,
  patch: { quantityOrdered?: number; unitCost?: number },
): Promise<PurchaseOrderItem> {
  const { data, error } = await client
    .from("purchase_order_items")
    .update({
      ...(patch.quantityOrdered !== undefined ? { quantity_ordered: patch.quantityOrdered } : {}),
      ...(patch.unitCost !== undefined ? { unit_cost: patch.unitCost } : {}),
    })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) throw error;
  return toPurchaseOrderItem(data);
}

export async function deletePurchaseOrderItem(
  client: DoubleAClient,
  itemId: string,
): Promise<void> {
  const { error } = await client.from("purchase_order_items").delete().eq("id", itemId);
  if (error) throw error;
}

/**
 * Records goods actually showing up. Bumps quantity_received (capped at
 * quantity_ordered by the row's own check constraint) and — for a line linked
 * to a real product — writes the matching restock movement, referenced back
 * at this PO. This is the only path a PO ever touches stock.
 */
export async function receivePurchaseOrderItem(
  client: DoubleAClient,
  input: {
    itemId: string;
    purchaseOrderId: string;
    productId: string | null;
    quantity: number;
    createdBy?: string;
  },
): Promise<PurchaseOrderItem> {
  if (input.quantity <= 0) {
    throw new Error("Quantity received must be greater than zero");
  }

  const { data: current, error: fetchError } = await client
    .from("purchase_order_items")
    .select("quantity_ordered, quantity_received")
    .eq("id", input.itemId)
    .single();
  if (fetchError) throw fetchError;

  const remaining = current.quantity_ordered - current.quantity_received;
  if (input.quantity > remaining) {
    throw new Error(`Only ${remaining} left to receive on this line`);
  }

  const { data, error } = await client
    .from("purchase_order_items")
    .update({ quantity_received: current.quantity_received + input.quantity })
    .eq("id", input.itemId)
    .select("*")
    .single();
  if (error) throw error;

  if (input.productId) {
    await adjustStock(client, {
      productId: input.productId,
      changeQuantity: input.quantity,
      reason: "restock",
      referenceId: input.purchaseOrderId,
      note: `Received on PO ${input.purchaseOrderId.slice(0, 8)}`,
      createdBy: input.createdBy,
    });
  }

  return toPurchaseOrderItem(data);
}

export async function markPaymentPaid(
  client: DoubleAClient,
  paymentId: string,
  paidDate?: string,
): Promise<PurchaseOrderPayment> {
  const { data, error } = await client
    .from("purchase_order_payments")
    .update({ is_paid: true, paid_date: paidDate ?? new Date().toISOString().slice(0, 10) })
    .eq("id", paymentId)
    .select("*")
    .single();

  if (error) throw error;
  return toPurchaseOrderPayment(data);
}

export async function markPaymentUnpaid(
  client: DoubleAClient,
  paymentId: string,
): Promise<PurchaseOrderPayment> {
  const { data, error } = await client
    .from("purchase_order_payments")
    .update({ is_paid: false, paid_date: null })
    .eq("id", paymentId)
    .select("*")
    .single();

  if (error) throw error;
  return toPurchaseOrderPayment(data);
}

export async function countOpenPurchaseOrders(client: DoubleAClient): Promise<number> {
  const { count, error } = await client
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["ordered", "partially_received"]);

  if (error) throw error;
  return count ?? 0;
}

/** Every unpaid installment term, owner-wide — the dashboard's payables figure. */
export async function sumSupplierBalance(client: DoubleAClient): Promise<number> {
  const { data, error } = await client
    .from("purchase_order_payments")
    .select("amount, purchase_orders!inner(status)")
    .neq("purchase_orders.status", "cancelled")
    .eq("is_paid", false);

  if (error) throw error;
  return roundMoney((data ?? []).reduce((sum, row) => sum + Number(row.amount), 0));
}

export interface UpcomingSupplierPayment {
  id: string;
  purchaseOrderId: string;
  supplierName: string;
  termNumber: number;
  dueDate: string | null;
  amount: number;
}

/** Unpaid terms due within `days`, soonest first — feeds the dashboard card. */
export async function listUpcomingSupplierPayments(
  client: DoubleAClient,
  days: number,
): Promise<UpcomingSupplierPayment[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const { data, error } = await client
    .from("purchase_order_payments")
    .select("id, purchase_order_id, term_number, due_date, amount, purchase_orders!inner(status, suppliers(name))")
    .eq("is_paid", false)
    .neq("purchase_orders.status", "cancelled")
    .lte("due_date", cutoffDay)
    .order("due_date", { ascending: true })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const { purchase_orders: po, ...term } = row as typeof row & {
      purchase_orders: { suppliers: { name: string } | null } | null;
    };

    return {
      id: term.id,
      purchaseOrderId: term.purchase_order_id,
      supplierName: po?.suppliers?.name ?? "—",
      termNumber: term.term_number,
      dueDate: term.due_date,
      amount: Number(term.amount),
    };
  });
}
