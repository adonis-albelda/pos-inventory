import { reportInventoryValuation } from "@double-a/api-client/queries";
import { csvExport } from "@/lib/export-route";

export async function GET(): Promise<Response> {
  return csvExport("stock-value", async (client) => {
    const rows = await reportInventoryValuation(client);

    return {
      headers: [
        "product",
        "sku",
        "category",
        "unit",
        "stock_quantity",
        "cost_price",
        "price",
        "value_at_cost",
        "value_at_shelf_price",
        "profit_if_sold",
      ],
      rows: rows.map((row) => [
        row.product_name,
        row.sku,
        row.category,
        row.unit,
        row.stock_quantity,
        row.cost_price,
        row.price,
        row.cost_value,
        row.retail_value,
        row.potential_profit,
      ]),
    };
  });
}
