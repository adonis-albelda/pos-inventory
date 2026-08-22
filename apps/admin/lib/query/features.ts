"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFeatureFlags, listFeatureFlagsAdmin } from "@double-a/api-client/queries";
import { getBrowserApiClient } from "@/lib/api/browser-client";
import { queryKeys } from "./keys";

/**
 * {key: enabled} for the caller's own company — what nav items, buttons, and
 * whole pages hide behind when a superadmin has turned a feature off. Any
 * key missing from this map (still loading, or a request that failed) reads
 * as enabled — CLAUDE.md's own pattern for a terminal that hasn't synced
 * yet: fail toward showing the app working, not toward hiding things.
 */
export function useFeatureFlags() {
  const query = useQuery({
    queryKey: queryKeys.featureFlags.mine(),
    queryFn: () => getFeatureFlags(getBrowserApiClient()),
    staleTime: 60_000,
  });

  return {
    ...query,
    isEnabled: (key: string) => query.data?.[key] ?? true,
  };
}

/** Superadmin-only (CLAUDE.md §15) — every flag, its global default, and every company overriding it. */
export function useFeatureFlagsAdmin() {
  return useQuery({
    queryKey: queryKeys.featureFlags.admin(),
    queryFn: () => listFeatureFlagsAdmin(getBrowserApiClient()),
    refetchOnMount: "always",
  });
}

/** Call after updateFeatureFlagAction/setCompanyFeatureOverrideAction (Server Actions) succeed — revalidatePath doesn't touch this cache. */
export function useInvalidateFeatureFlags() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags.all });
}
