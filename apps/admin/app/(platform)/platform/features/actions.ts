"use server";

import { setCompanyFeatureOverride, updateFeatureFlag } from "@double-a/api-client/queries";
import { ApiError } from "@double-a/api-client";
import { requireSuperadmin } from "@/lib/platform";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Unknown error";
}

/** The "for all companies" default — a per-company override still wins over this. */
export async function updateFeatureFlagAction(
  key: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
  const { client } = await requireSuperadmin();

  try {
    await updateFeatureFlag(client, key, enabled);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  return { error: null };
}

/** enabled=null clears the override, reverting that one company to the global default. */
export async function setCompanyFeatureOverrideAction(
  companyId: string,
  key: string,
  enabled: boolean | null,
): Promise<{ error: string | null }> {
  const { client } = await requireSuperadmin();

  try {
    await setCompanyFeatureOverride(client, companyId, key, enabled);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  return { error: null };
}
