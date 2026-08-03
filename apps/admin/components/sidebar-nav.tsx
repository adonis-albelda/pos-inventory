"use client";

import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChartColumn,
  ContactRound,
  FolderTree,
  LayoutDashboard,
  LoaderCircle,
  Package,
  Receipt,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The nav lives here rather than in the server layout because an icon is a
 * function, and a function cannot cross the server/client boundary as a prop.
 */
const NAV: { href: Route; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/customers" as Route, label: "Customers", icon: ContactRound },
  { href: "/expenses" as Route, label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3 lg:py-0">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={[
              "flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-body transition-colors lg:min-h-0",
              active ? "bg-primary font-medium text-white" : "text-ink hover:bg-border/50",
            ].join(" ")}
          >
            <Icon
              size={18}
              strokeWidth={2}
              className={active ? "text-white" : "text-ink-muted"}
            />
            {label}
            <NavPending active={active} />
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * A page's data is fetched on the server, so a click on a heavy report can sit
 * for a second with nothing to show for it. This says the click landed. It has
 * to be a child of `Link` — that is where `useLinkStatus` reads from.
 */
function NavPending({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <LoaderCircle
      size={14}
      strokeWidth={2.5}
      aria-label="Loading"
      className={[
        "ml-auto animate-spin",
        active ? "text-white" : "text-primary",
      ].join(" ")}
    />
  );
}
