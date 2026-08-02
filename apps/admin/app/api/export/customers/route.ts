import { listCustomers } from "@double-a/supabase";
import { csvExport } from "@/lib/export-route";

export async function GET(): Promise<Response> {
  return csvExport("customers", async (supabase) => {
    const customers = await listCustomers(supabase);

    return {
      headers: ["name", "contact", "address"],
      rows: customers.map((customer) => [
        customer.name,
        customer.contact,
        customer.address,
      ]),
    };
  });
}
