"use server";

import { revalidatePath } from "next/cache";
import { roundMoney } from "@double-a/shared-types";
import { createPurchaseOrder, currentAppUser } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";

export interface CreatePurchaseOrderInput {
  supplierId: string;
  orderDate: string;
  expectedDate: string | null;
  referenceNo: string | null;
  notes: string | null;
  items: {
    productId: string;
    productName: string;
    quantityOrdered: number;
    unitCost: number;
  }[];
  terms: { termNumber: number; dueDate: string | null; amount: number }[];
}

export type CreatePurchaseOrderResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Called directly from the client builder (not bound to a <form action>), so
 * it takes a plain object rather than FormData — the item and term rows are
 * already structured on that side.
 */
export async function createPurchaseOrderAction(
  input: CreatePurchaseOrderInput,
): Promise<CreatePurchaseOrderResult> {
  if (!input.supplierId) return { ok: false, error: "Pick a supplier." };
  if (input.items.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)) {
    return { ok: false, error: "Pick a valid order date." };
  }

  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (user?.role !== "admin") {
    return { ok: false, error: "Only the owner can create a purchase order." };
  }

  try {
    const created = await createPurchaseOrder(supabase, {
      header: {
        supplier_id: input.supplierId,
        order_date: input.orderDate,
        expected_date: input.expectedDate,
        reference_no: input.referenceNo,
        notes: input.notes,
        created_by: user.id,
      },
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantityOrdered: Math.max(1, Math.round(item.quantityOrdered)),
        unitCost: roundMoney(item.unitCost),
      })),
      terms: input.terms.map((term) => ({
        termNumber: term.termNumber,
        dueDate: term.dueDate,
        amount: roundMoney(term.amount),
      })),
    });

    revalidatePath("/purchase-orders");
    revalidatePath("/suppliers");
    revalidatePath("/");
    return { ok: true, id: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: `Could not create the purchase order: ${message}` };
  }
}
