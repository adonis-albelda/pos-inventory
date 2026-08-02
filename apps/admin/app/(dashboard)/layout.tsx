import { currentAppUser, fetchStoreSettings } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerClient();
  const [user, store] = await Promise.all([
    currentAppUser(supabase),
    fetchStoreSettings(supabase),
  ]);

  const initials = (user?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DashboardShell
      storeName={store.name}
      storeLogoUrl={store.logoUrl}
      userName={user?.name ?? null}
      userEmail={user?.email ?? null}
      initials={initials}
    >
      {children}
    </DashboardShell>
  );
}
