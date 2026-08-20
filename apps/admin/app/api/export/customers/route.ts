import { listCustomers } from "@double-a/api-client/queries";
import { csvExport } from "@/lib/export-route";

export async function GET(): Promise<Response> {
  return csvExport("customers", async (client) => {
    const customers = await listCustomers(client);

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
