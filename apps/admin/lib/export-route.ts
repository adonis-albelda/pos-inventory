import type { ApiClient } from "@double-a/api-client";
import { toCsv, type CsvValue } from "@/lib/csv";
import { storeToday } from "@/lib/date-range";
import { getAuthedClient, getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";

/**
 * Every export carries supplier prices and margin, so each route checks the
 * role itself rather than trusting that the button was only ever shown to the
 * owner. The API refuses a non-admin read too; this just turns that into a
 * clear 403 instead of a stack trace.
 */
export async function csvExport(
  name: string,
  build: (client: ApiClient) => Promise<{ headers: string[]; rows: CsvValue[][] }>,
): Promise<Response> {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Sign in to download this file.\n", { status: 401 });
  }
  if (!isShopAdmin(user)) {
    return new Response("Downloads are for the owner's account.\n", { status: 403 });
  }

  let csv: string;
  try {
    const { headers, rows } = await build(getAuthedClient());
    csv = toCsv(headers, rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Could not build the file: ${message}\n`, { status: 500 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${storeToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
