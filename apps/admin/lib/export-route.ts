import { currentAppUser, type DoubleAClient } from "@double-a/supabase";
import { toCsv, type CsvValue } from "@/lib/csv";
import { storeToday } from "@/lib/date-range";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Every export carries supplier prices and margin, so each route checks the
 * role itself rather than trusting that the button was only ever shown to the
 * owner. The database refuses a non-admin too; this just turns that into a
 * clear 403 instead of a stack trace.
 */
export async function csvExport(
  name: string,
  build: (client: DoubleAClient) => Promise<{ headers: string[]; rows: CsvValue[][] }>,
): Promise<Response> {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (!user) {
    return new Response("Sign in to download this file.\n", { status: 401 });
  }
  if (user.role !== "admin") {
    return new Response("Downloads are for the owner's account.\n", { status: 403 });
  }

  let csv: string;
  try {
    const { headers, rows } = await build(supabase);
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
