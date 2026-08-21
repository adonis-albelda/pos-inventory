import type { SaleWithItems } from "@double-a/shared-types";
import { ApiError, type ApiClient, type JsonApiPage, type JsonApiResource } from "../http";
import { type SaleAttrs, toSaleWithItems } from "../mappers";

/**
 * The POS's own sales still only ever arrive through the mobile sync push
 * flow (`POST /pos/sync/sales`, see queries/pos.ts) — client-generated
 * UUIDs, offline-first, per CLAUDE.md rule 3. `createSale` below is a
 * different thing: an admin-only "rung up directly in the office" sale
 * (e.g. a phone order), server-generates its own id, and is admin-only —
 * `StoreSaleRequest::authorize()` checks actsAsAdmin() directly rather than
 * the shared create ability sync push relies on.
 */

/**
 * GAP: the old PostgREST `SalesFilter` also supported `from`/`to` (a date
 * range), `userId`, `deviceId`, `fulfillment`, `isPaid`, `deliveryOpen`, and
 * an arbitrary `limit`. `IndexSalesController` only accepts `customer_id` and
 * `status`, paginated (`per_page`, capped server-side at 200). A caller
 * needing date-ranged reports or the Delivery tab's "open deliveries on this
 * terminal" view (fulfillment=delivery, delivery_completed=false,
 * status=completed) has to filter client-side over `status=completed`
 * results, or ask backend to extend the endpoint.
 */
export interface SalesFilter {
  customerId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listSalesPage(
  client: ApiClient,
  filter: SalesFilter = {},
): Promise<{ sales: SaleWithItems[]; total: number; lastPage: number }> {
  const page = await client.get<JsonApiPage<SaleAttrs>>("/sales", {
    customer_id: filter.customerId,
    status: filter.status,
    page: filter.page ?? 1,
    per_page: filter.pageSize ?? 50,
  });

  return {
    sales: page.data.map(toSaleWithItems),
    total: page.meta?.total ?? page.data.length,
    lastPage: page.meta?.last_page ?? 1,
  };
}

/**
 * Single-page fetch, mirroring the old `.limit(n)` query — not a full walk.
 *
 * GAP: `cashierName` (joined from `users(name)` in the old query) has no
 * equivalent on `SaleResource`, which only carries `user_id`. Dropped from
 * the return type; ask backend to add it to the resource if a report needs
 * to display who rang up a sale.
 */
export async function listSales(
  client: ApiClient,
  filter: SalesFilter & { limit?: number } = {},
): Promise<SaleWithItems[]> {
  const result = await listSalesPage(client, {
    customerId: filter.customerId,
    status: filter.status,
    page: 1,
    pageSize: Math.min(filter.limit ?? 100, 200),
  });
  return result.sales;
}

export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
  /** Defaults to the product's shelf price — set to log a counter discount, same as the POS. */
  unitPrice?: number;
}

export interface CreateSaleInput {
  items: CreateSaleItemInput[];
  paymentMethod: "cash" | "gcash" | "card";
  customerId?: string;
  /** Defaults to true for cash, false otherwise — same rule the POS follows (CLAUDE.md §12). */
  isPaid?: boolean;
  fulfillment?: "pickup" | "delivery";
}

/** Admin-only. See the file-level note above — this is not the POS's sale path. */
export async function createSale(client: ApiClient, input: CreateSaleInput): Promise<SaleWithItems> {
  const { data } = await client.post<{ data: JsonApiResource<SaleAttrs> }>(
    "/sales",
    {
      items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      payment_method: input.paymentMethod,
      customer_id: input.customerId,
      is_paid: input.isPaid,
      fulfillment: input.fulfillment,
    },
    { idempotent: true },
  );
  return toSaleWithItems(data);
}

export async function getSale(client: ApiClient, id: string): Promise<SaleWithItems | null> {
  try {
    const { data } = await client.get<{ data: JsonApiResource<SaleAttrs> }>(`/sales/${id}`);
    return toSaleWithItems(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Voiding is the only reversal path — sales are never deleted. Laravel's
 * `SaleObserver` restores stock for every line when status flips to voided
 * (ports the old `void_restore` trigger). Bare POST, no body —
 * `VoidSaleController` takes none.
 */
export async function voidSale(client: ApiClient, id: string): Promise<SaleWithItems> {
  const { data } = await client.post<{ data: JsonApiResource<SaleAttrs> }>(
    `/sales/${id}/void`,
    undefined,
    { idempotent: true },
  );
  return toSaleWithItems(data);
}

/**
 * The only write path for `is_paid` / `delivery_completed` (CLAUDE.md rule
 * 12). `PatchSaleFlagsRequest` requires both fields together — there is no
 * partial patch, and `fulfillment` cannot be changed through this endpoint
 * at all (GAP vs. the old `updateSaleFlags`, which could also patch
 * `fulfillment`; ask backend for a route if that turns out to be needed).
 */
export async function patchSaleFlags(
  client: ApiClient,
  id: string,
  flags: { isPaid: boolean; deliveryCompleted: boolean },
): Promise<SaleWithItems> {
  const { data } = await client.patch<{ data: JsonApiResource<SaleAttrs> }>(`/sales/${id}/flags`, {
    is_paid: flags.isPaid,
    delivery_completed: flags.deliveryCompleted,
  });
  return toSaleWithItems(data);
}

/**
 * Swaps a line item for a different product on an already-completed sale.
 * Admin-only. The original line is never rewritten — it's flagged and a new
 * line carries the replacement — so `total_amount` on the returned sale may
 * differ from before the call; re-render from this response, not a diff.
 */
export async function replaceSaleItem(
  client: ApiClient,
  saleId: string,
  saleItemId: string,
  input: { productId: string; quantity?: number },
): Promise<SaleWithItems> {
  const { data } = await client.post<{ data: JsonApiResource<SaleAttrs> }>(
    `/sales/${saleId}/items/${saleItemId}/replace`,
    { product_id: input.productId, quantity: input.quantity },
    { idempotent: true },
  );
  return toSaleWithItems(data);
}
