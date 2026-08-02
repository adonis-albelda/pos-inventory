import { marginPercent } from "@double-a/shared-types";
import { listProducts } from "@double-a/supabase";
import { csvExport } from "@/lib/export-route";

/**
 * The catalogue, laid out so the same file can be edited and handed back to
 * the importer. stock_quantity rides along for reference only — the importer
 * ignores it, because stock moves through Inventory alone.
 */
export async function GET(): Promise<Response> {
  return csvExport("products", async (supabase) => {
    const products = await listProducts(supabase, { includeInactive: true });

    return {
      headers: [
        "name",
        "sku",
        "price",
        "cost_price",
        "margin_percent",
        "unit",
        "barcode",
        "reorder_point",
        "bulk_price",
        "bulk_min_quantity",
        "category",
        "is_active",
        "stock_quantity",
      ],
      rows: products.map((product) => [
        product.name,
        product.sku,
        product.price,
        product.costPrice,
        marginPercent(product.price, product.costPrice),
        product.unit,
        product.barcode,
        product.reorderPoint,
        product.bulkPrice,
        product.bulkMinQuantity,
        product.category,
        product.isActive,
        product.stockQuantity,
      ]),
    };
  });
}
