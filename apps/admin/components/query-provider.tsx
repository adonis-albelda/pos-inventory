"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * One QueryClient per browser session, created inside the component (not at
 * module scope) so server rendering never shares cache/state across users —
 * standard App Router pattern. staleTime > 0 by default: admin is read-heavy
 * navigation (products, customers, suppliers... back and forth), and every
 * write path already calls queryClient.invalidateQueries() on success (see
 * lib/query/*), so a stale-while-fine default doesn't hide a change you just
 * made — it only skips a redundant refetch on data nothing touched.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
