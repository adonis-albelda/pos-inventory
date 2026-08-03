"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid, LogOut } from "lucide-react";
import { storeInitial } from "@double-a/shared-types";
import { signOut } from "@/app/login/actions";
import { UiModeToggle } from "@/components/ui-mode-toggle";
import { NAV_GROUPS } from "@/lib/nav";
import type { UiMode } from "@/lib/ui-mode";

/**
 * The desktop-launcher chrome: a title bar, a menu bar of dropdowns, and a
 * status strip — the shape of the till software many owners ran before this.
 * Pages inside are unchanged; only navigation looks different.
 */
export function ClassicShell({
  storeName,
  storeLogoUrl,
  userName,
  userEmail,
  mode,
  children,
}: {
  storeName: string;
  storeLogoUrl: string | null;
  userName: string | null;
  userEmail: string | null;
  mode: UiMode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const brandMark = storeLogoUrl ? (
    <img
      src={storeLogoUrl}
      alt=""
      className="size-7 shrink-0 rounded-sm bg-white object-contain"
    />
  ) : (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-white/15 text-caption font-bold text-white">
      {storeInitial(storeName)}
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Title bar */}
      <div className="flex items-center gap-3 bg-primary px-3 py-2 text-white">
        {brandMark}
        <span className="min-w-0 truncate text-body font-semibold tracking-tight">
          {storeName} — Back Office
        </span>
        <span className="ml-auto hidden truncate text-caption text-white/75 sm:block">
          {userName ?? "Signed in"}
          {userEmail ? ` · ${userEmail}` : ""}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-sm border border-white/25 px-2 py-1 text-caption transition-colors hover:bg-white/10"
          >
            <LogOut size={13} strokeWidth={2} />
            Exit
          </button>
        </form>
      </div>

      {/* Menu bar */}
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1"
        onMouseLeave={() => setOpenGroup(null)}
      >
        <Link
          href="/menu"
          className={[
            "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-caption font-medium transition-colors",
            pathname === "/menu"
              ? "bg-primary text-white"
              : "text-ink hover:bg-border/60",
          ].join(" ")}
        >
          <LayoutGrid size={14} strokeWidth={2} />
          Main menu
        </Link>

        {NAV_GROUPS.filter((group) => group.label).map((group) => {
          const label = group.label as string;
          const open = openGroup === label;
          const active = group.items.some((item) =>
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
          );

          return (
            <div key={label} className="relative">
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : label)}
                onMouseEnter={() => setOpenGroup(label)}
                className={[
                  "inline-flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-caption transition-colors",
                  active || open
                    ? "bg-border/70 font-medium text-ink"
                    : "text-ink hover:bg-border/60",
                ].join(" ")}
              >
                {label}
                <ChevronDown size={13} strokeWidth={2} className="text-ink-muted" />
              </button>

              {open ? (
                <div className="absolute top-full left-0 z-30 mt-0.5 min-w-52 rounded-sm border border-border bg-surface py-1 shadow-md">
                  {group.items.map(({ href, label: itemLabel, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpenGroup(null)}
                      className="flex items-center gap-2.5 px-3 py-2 text-caption text-ink transition-colors hover:bg-primary-tint"
                    >
                      <Icon size={15} strokeWidth={2} className="text-ink-muted" />
                      {itemLabel}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        <UiModeToggle mode={mode} className="ml-auto w-auto [&_button]:w-auto" />
      </div>

      <main className="flex-1 px-3 py-3">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Status strip */}
      <footer className="border-t border-border bg-surface px-3 py-1.5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
          <span>{storeName}</span>
          <span className="hidden sm:inline">{userEmail}</span>
          <span className="ml-auto">
            Powered by:{" "}
            <a
              href="mailto:doubleadigitalsolutions@gmail.com"
              className="underline decoration-border underline-offset-2 hover:text-ink"
            >
              doubleadigitalsolutions@gmail.com
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
