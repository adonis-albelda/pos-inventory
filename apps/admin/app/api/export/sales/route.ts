import { lineProfit } from "@double-a/shared-types";
import { listSales } from "@double-a/supabase";
import { resolveRange } from "@/lib/date-range";
import { csvExport } from "@/lib/export-route";

/** Well past a busy month on one terminal, and PostgREST caps it anyway. */
const MAX_SALES = 5000;

/**
 * One row per line item, not per sale: this is the file that gets opened in a
 * spreadsheet and pivoted, and a sale total alone cannot answer "which
 * products did we discount in March".
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const { range } = resolveRange({
    preset: params.get("preset") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  const status = params.get("status") ?? undefined;

  return csvExport("sales", async (supabase) => {
    const sales = await listSales(supabase, {
      from: range.from,
      // listSales filters `to` inclusively; the range end is exclusive.
      to: new Date(Date.parse(range.to) - 1).toISOString(),
      status,
      limit: MAX_SALES,
    });

    const rows = sales.flatMap((sale) =>
      sale.items.map((item) => [
        sale.createdAt,
        sale.id,
        sale.cashierName,
        sale.deviceId,
        sale.paymentMethod,
        sale.status,
        // Blank on most rows: only a delivery or an account sale carries these.
        sale.customerName,
        sale.customerContact,
        sale.customerAddress,
        item.productName,
        item.quantity,
        item.listPrice,
        item.unitPrice,
        item.unitCost,
        item.subtotal,
        lineProfit(item.unitPrice, item.unitCost, item.quantity),
      ]),
    );

    return {
      headers: [
        "sold_at",
        "sale_id",
        "cashier",
        "terminal",
        "payment",
        "status",
        "customer_name",
        "customer_contact",
        "customer_address",
        "product",
        "quantity",
        "list_price",
        "unit_price",
        "unit_cost",
        "subtotal",
        "line_profit",
      ],
      rows,
    };
  });
}
