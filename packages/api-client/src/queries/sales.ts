import type { SaleWithItems } from "@double-a/shared-types";
import { ApiError, type ApiClient, type JsonApiPage, type JsonApiResource } from "../http";
import { type SaleAttrs, toSaleWithItems } from "../mappers";

/**
 * IMPORTANT — sales are never created from this client. The only writer is
 * the mobile POS sync push flow (`POST /pos/sync/sales`, see queries/pos.ts),
 * per CLAUDE.md rule 3 (client-generated UUIDs, offline-first). This file is
 * read/void/flag-patch only — admin reporting and the Delivery tab's flag
 * updates.
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
