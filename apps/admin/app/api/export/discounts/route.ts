import { reportDiscounts } from "@double-a/api-client/queries";
import { resolveRange } from "@/lib/date-range";
import { csvExport } from "@/lib/export-route";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const { range } = resolveRange({
    preset: params.get("preset") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  return csvExport("discounts", async (client) => {
    const rows = await reportDiscounts(client, range);

    return {
      headers: [
        "sold_at",
        "sale_id",
        "cashier",
        "terminal",
        "product",
        "quantity",
        "list_price",
        "sold_for",
        "given_away",
        "discount_percent",
        "below_cost",
      ],
      rows: rows.map((row) => [
        row.sold_at,
        row.sale_id,
        row.cashier_name,
        row.device_id,
        row.product_name,
        row.quantity,
        row.list_price,
        row.unit_price,
        row.discount_total,
        row.discount_percent,
        row.below_cost,
      ]),
    };
  });
}
