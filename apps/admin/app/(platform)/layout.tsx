import { PlatformShell } from "@/components/platform-shell";
import { requireSuperadmin } from "@/lib/platform";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSuperadmin();

  const initials = (user?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <PlatformShell
      userName={user?.name ?? null}
      userEmail={user?.email ?? null}
      initials={initials}
    >
      {children}
    </PlatformShell>
  );
}
