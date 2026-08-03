import type { Route } from "next";
import {
  Boxes,
  ChartColumn,
  ContactRound,
  FolderTree,
  LayoutDashboard,
  Package,
  Receipt,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** Shown on the classic launcher tiles, where there is room for a line. */
  blurb: string;
  /** Tile colour on the classic launcher — legacy screens are colour-coded. */
  tone: "primary" | "accent" | "success" | "warning" | "danger" | "neutral";
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * One nav definition, read by both shells. Categories sit under Settings with
 * company details: both shape how the shop is set up, not day-to-day selling.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        blurb: "Today's takings at a glance",
        tone: "primary",
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        href: "/products",
        label: "Products",
        icon: Package,
        blurb: "Prices, cost, barcodes",
        tone: "primary",
      },
      {
        href: "/inventory",
        label: "Inventory",
        icon: Boxes,
        blurb: "Stock counts and movements",
        tone: "success",
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        href: "/sales",
        label: "Sales",
        icon: Receipt,
        blurb: "Every receipt on file",
        tone: "accent",
      },
      {
        href: "/customers" as Route,
        label: "Customers",
        icon: ContactRound,
        blurb: "Names, addresses, contacts",
        tone: "neutral",
      },
      {
        href: "/expenses" as Route,
        label: "Expenses",
        icon: Wallet,
        blurb: "Rent, wages, utilities",
        tone: "danger",
      },
      {
        href: "/reports",
        label: "Reports",
        icon: ChartColumn,
        blurb: "Profit, discounts, dead stock",
        tone: "warning",
      },
    ],
  },
  {
    label: "Team",
    items: [
      {
        href: "/users",
        label: "Users",
        icon: Users,
        blurb: "Cashiers, admins, terminals",
        tone: "primary",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/categories",
        label: "Categories",
        icon: FolderTree,
        blurb: "Shelf tree and markup",
        tone: "success",
      },
      {
        href: "/settings",
        label: "Company",
        icon: Store,
        blurb: "Shop name, logo, receipt footer",
        tone: "neutral",
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
