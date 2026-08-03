import { listMovements, listProducts, listUsers } from "@double-a/supabase";
import { resolveDayWindow } from "@/lib/date-range";
import { csvExport } from "@/lib/export-route";
import { isReason, reasonLabel } from "@/lib/inventory-reasons";

/** A long history in a spreadsheet, and PostgREST caps the response anyway. */
const MAX_MOVEMENTS = 5000;

/**
 * The stock ledger as a file: every movement the same filters on the Inventory
 * page produced, with product names and who recorded each one resolved so the
 * sheet reads without a second lookup.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const window = resolveDayWindow({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  const reason = params.get("reason") ?? undefined;
  const productId = params.get("product") ?? undefined;

  return csvExport("stock-movements", async (supabase) => {
    const [movements, products, users] = await Promise.all([
      listMovements(supabase, {
        productId,
        reasons: isReason(reason) ? [reason] : undefined,
        from: window.from,
        to: window.to,
        limit: MAX_MOVEMENTS,
      }),
      listProducts(supabase, { includeInactive: true }),
      listUsers(supabase, { includeInactive: true }),
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
