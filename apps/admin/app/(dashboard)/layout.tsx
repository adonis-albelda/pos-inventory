import { currentAppUser, fetchStoreSettings } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { ClassicShell } from "@/components/classic-shell";
import { DashboardShell } from "@/components/dashboard-shell";
import { getUiMode } from "@/lib/ui-mode";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerClient();
  const [user, store, mode] = await Promise.all([
    currentAppUser(supabase),
    fetchStoreSettings(supabase),
    getUiMode(),
  ]);

  const initials = (user?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (mode === "classic") {
    return (
      <ClassicShell
        storeName={store.name}
        storeLogoUrl={store.logoUrl}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        mode={mode}
      >
        {children}
      </ClassicShell>
    );
  }

  return (
    <DashboardShell
      storeName={store.name}
      storeLogoUrl={store.logoUrl}
      userName={user?.name ?? null}
      userEmail={user?.email ?? null}
      initials={initials}
      mode={mode}
    >
      {children}
    </DashboardShell>
  );
}
