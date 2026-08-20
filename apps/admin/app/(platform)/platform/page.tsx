import { requireSuperadmin } from "@/lib/platform";
import { PlatformPageClient } from "./platform-page-client";

/**
 * Stays a thin Server Component so the superadmin-only gate runs before any
 * of the client bundle/data below it ever mounts — same split as
 * suppliers/page.tsx. The company list itself (companyStats — the caller's
 * own regular session, no scoped token) is client-side TanStack Query, in
 * PlatformPageClient.
 */
export default async function PlatformPage() {
  await requireSuperadmin();

  return <PlatformPageClient />;
}
