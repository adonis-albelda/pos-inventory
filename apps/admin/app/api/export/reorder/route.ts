import { listBelowReorder } from "@double-a/api-client/queries";
import { csvExport } from "@/lib/export-route";

/** The list you take to the supplier. */
export async function GET(): Promise<Response> {
  return csvExport("reorder-list", async (client) => {
    const rows = await listBelowReorder(client);

    return {
      headers: [
        "product",
        "sku",
        "category",
        "unit",
        "stock_quantity",
        "reorder_point",
        "short_by",
        "cost_price",
        "cost_to_restock",
      ],
      // GAP: listBelowReorder now returns plain Product rows (see
      // queries/products.ts) — short_by/cost_to_restock derived here.
      rows: rows.map((row) => {
        const shortBy = Math.max(row.reorderPoint - row.stockQuantity, 0);
        return [
          row.name,
          row.sku,
          row.category,
          row.unit,
          row.stockQuantity,
          row.reorderPoint,
          shortBy,
          row.costPrice,
          shortBy * row.costPrice,
        ];
      }),
    };
  });
}
