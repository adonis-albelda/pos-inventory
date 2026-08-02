import { listBelowReorder } from "@double-a/supabase";
import { csvExport } from "@/lib/export-route";

/** The list you take to the supplier. */
export async function GET(): Promise<Response> {
  return csvExport("reorder-list", async (supabase) => {
    const rows = await listBelowReorder(supabase);

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
      rows: rows.map((row) => [
        row.name,
        row.sku,
        row.category,
        row.unit,
        row.stock_quantity,
        row.reorder_point,
        row.short_by,
        row.cost_price,
        row.restock_cost,
      ]),
    };
  });
}
