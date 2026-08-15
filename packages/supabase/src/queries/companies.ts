import type { CompanyStats } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";

export async function companyStats(
  client: DoubleAClient,
): Promise<CompanyStats[]> {
  const { data, error } = await client.rpc("company_stats");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    productCount: Number(row.product_count),
    categoryCount: Number(row.category_count),
    supplierCount: Number(row.supplier_count),
    customerCount: Number(row.customer_count),
    saleCount: Number(row.sale_count),
    userCount: Number(row.user_count),
    stockUnits: Number(row.stock_units),
  }));
}
