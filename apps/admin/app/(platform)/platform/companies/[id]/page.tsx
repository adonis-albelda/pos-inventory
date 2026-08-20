import { notFound } from "next/navigation";
import { ApiError } from "@double-a/api-client";
import { listUsers, openCompany as apiOpenCompany } from "@double-a/api-client/queries";
import { requireSuperadmin } from "@/lib/platform";
import { createScopedClient } from "@/lib/api/client";
import { CompanyDetailPageClient } from "./company-detail-page-client";

/**
 * Stays a Server Component for the "open company to list its users" read —
 * apiOpenCompany() mints a one-off bearer token scoped to this company via
 * acting_company_id (CLAUDE.md §15) purely to satisfy IndexUsersController's
 * company.context scoping; the token is used once, here, and discarded
 * within this request. It must never reach client JS, so it — and the
 * listUsers() call that uses it — cannot move into CompanyDetailPageClient.
 *
 * companyStats() is different: it runs on the caller's own regular
 * superadmin session, no scoped token involved, so it's safe to convert to
 * client-side useQuery — see CompanyDetailPageClient / lib/query/companies.ts.
 */
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client } = await requireSuperadmin();

  let users;
  try {
    // No cross-company user listing endpoint for a company the superadmin
    // hasn't opened — IndexUsersController is company.context-scoped off the
    // token. Opens it just for this read; the resulting token isn't the
    // caller's session (their cookie/navigation is untouched) and is simply
    // left unrevoked rather than tracked for cleanup — acceptable superadmin
    // token hygiene tradeoff, not a security hole.
    const opened = await apiOpenCompany(client, id);
    users = (
      await listUsers(createScopedClient(opened.token), { includeInactive: true })
    ).filter((user) => user.role !== "superadmin");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return <CompanyDetailPageClient companyId={id} users={users} />;
}
