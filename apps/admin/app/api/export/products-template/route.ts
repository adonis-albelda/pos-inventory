import { TEMPLATE_EXAMPLE, TEMPLATE_HEADERS } from "@/lib/product-import";
import { csvExport } from "@/lib/export-route";

/** The header row and one filled-in line, so the layout is never a guess. */
export async function GET(): Promise<Response> {
  return csvExport("product-import-template", async () => ({
    headers: [...TEMPLATE_HEADERS],
    rows: [TEMPLATE_EXAMPLE],
  }));
}
