import { currentAppUser } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { PlatformShell } from "@/components/platform-shell";
import { requireSuperadmin } from "@/lib/platform";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadmin();
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

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
