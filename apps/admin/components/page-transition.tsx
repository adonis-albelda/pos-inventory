"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Restarts the page-enter animation on every route change. Lives in
 * `app/(dashboard)/template.tsx` so the sidebar in the layout never moves.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="space-y-6 motion-safe:animate-page-enter">
      {children}
    </div>
  );
}
