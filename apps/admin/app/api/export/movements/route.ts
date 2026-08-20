import { listMovementsPage, listProducts, listUsers } from "@double-a/api-client/queries";
import { resolveDayWindow } from "@/lib/date-range";
import { csvExport } from "@/lib/export-route";
import { isReason, reasonLabel } from "@/lib/inventory-reasons";

/** A long history in a spreadsheet, and the walk below is bounded anyway. */
const MAX_MOVEMENTS = 5000;

/**
 * The stock ledger as a file: every movement the same filters on the Inventory
 * page produced, with product names and who recorded each one resolved so the
 * sheet reads without a second lookup.
 *
 * GAP: IndexInventoryMovementsController only accepts `product_id` (see
 * queries/inventory.ts) — no `reason` or date-range filter server-side.
 * Without a `product` filter this walks the WHOLE movement history up to
 * MAX_MOVEMENTS, filtering reason/date client-side — slow for a shop with a
 * long history; ask backend to extend the endpoint if this export gets used
 * often without narrowing to one product.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const window = resolveDayWindow({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  const reason = params.get("reason") ?? undefined;
  const productId = params.get("product") ?? undefined;

  return csvExport("stock-movements", async (client) => {
    const allMovements = [];
    let page = 1;
    for (;;) {
      const result = await listMovementsPage(client, { productId, page, pageSize: 200 });
      allMovements.push(...result.movements);
      if (allMovements.length >= MAX_MOVEMENTS || page >= result.lastPage) break;
      page += 1;
    }

    const movements = allMovements
      .filter((m) => !isReason(reason) || m.reason === reason)
      .filter((m) => !window.from || m.createdAt >= window.from)
      .filter((m) => !window.to || m.createdAt < window.to)
      .slice(0, MAX_MOVEMENTS);

    const [products, users] = await Promise.all([
      listProducts(client, { includeInactive: true }),
      listUsers(client, { includeInactive: true }),
    ]);

    const productById = new Map(products.map((product) => [product.id, product]));
    const userNames = new Map(users.map((user) => [user.id, user.name]));

    return {
      headers: [
        "recorded_at",
        "product",
        "sku",
        "category",
        "reason",
        "change_quantity",
        "note",
        "recorded_by",
        "sale_id",
      ],
      rows: movements.map((movement) => {
        const product = productById.get(movement.productId);

        return [
          movement.createdAt,
          product?.name ?? null,
          product?.sku ?? null,
          product?.category ?? null,
          reasonLabel(movement.reason),
          movement.changeQuantity,
          movement.note,
          movement.createdBy ? (userNames.get(movement.createdBy) ?? null) : "Terminal",
          movement.referenceId,
        ];
      }),
    };
  });
}
