import { listUsers } from "@double-a/api-client/queries";
import { csvExport } from "@/lib/export-route";

export async function GET(): Promise<Response> {
  return csvExport("users", async (client) => {
    const users = await listUsers(client, { includeInactive: true });

    return {
      headers: ["name", "email", "role", "is_active", "can_sell", "must_change_password"],
      rows: users.map((user) => [
        user.name,
        user.email,
        user.role,
        user.isActive,
        user.canSell,
        user.mustChangePassword,
      ]),
    };
  });
}
