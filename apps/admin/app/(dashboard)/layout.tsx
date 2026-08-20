import { getStoreSettings } from "@double-a/api-client/queries";
import { getAuthedClient, getCurrentUser } from "@/lib/api/session";
import { ClassicShell } from "@/components/classic-shell";
import { DashboardShell } from "@/components/dashboard-shell";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { getUiMode } from "@/lib/ui-mode";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, store, mode] = await Promise.all([
    getCurrentUser(),
    getStoreSettings(getAuthedClient()),
    getUiMode(),
  ]);

  const initials = (user?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const content =
    user?.role === "superadmin" ? (
      <>
        <ImpersonationBanner storeName={store.name} />
        {children}
      </>
    ) : (
      children
    );

  if (mode === "classic") {
    return (
      <ClassicShell
        storeName={store.name}
        storeLogoUrl={store.logoUrl}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        mode={mode}
      >
        {content}
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
      {content}
    </DashboardShell>
  );
}
