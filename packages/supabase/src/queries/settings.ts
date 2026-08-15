import {
  DEFAULT_RECEIPT_LAYOUT,
  DEFAULT_STORE_SETTINGS,
  type ReceiptLayout,
  type StoreSettings,
} from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesUpdate } from "../database.types";
import { toReceiptLayout, toStoreSettings } from "../mappers";

/** Where an uploaded logo lives. Public, so a POS header can fetch it. */
export const STORE_LOGO_BUCKET = "store-logos";

/**
 * The one settings row for the session's company. RLS returns at most one.
 * A miss means the company has not been seeded — falling back to defaults
 * keeps a fresh checkout usable instead of blanking every page that reads the
 * shop name.
 */
export async function fetchStoreSettings(
  client: DoubleAClient,
): Promise<StoreSettings> {
  const { data, error } = await client
    .from("store_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toStoreSettings(data) : DEFAULT_STORE_SETTINGS;
}

export async function updateStoreSettings(
  client: DoubleAClient,
  patch: TablesUpdate<"store_settings">,
): Promise<StoreSettings> {
  const { data, error } = await client
    .from("store_settings")
    .update(patch)
    .select("*")
    .single();

  if (error) throw error;
  return toStoreSettings(data);
}

/**
 * Puts the logo in storage and hands back its public URL, which is what gets
 * written to `store_settings.logo_url`.
 *
 * The object name carries a timestamp rather than being a fixed `logo.png`:
 * the URL is public and cached hard by browsers and devices, so reusing one
 * name leaves terminals showing the old mark for as long as their cache holds.
 */
export async function uploadStoreLogo(
  client: DoubleAClient,
  file: File | Blob,
  extension: string,
): Promise<string> {
  const path = `logo-${Date.now()}.${extension.replace(/^\./, "").toLowerCase()}`;

  const { error } = await client.storage
    .from(STORE_LOGO_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: true });

  if (error) throw error;

  const { data } = client.storage.from(STORE_LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * The one receipt-layout row. Seeded by migration; a miss means migrate first.
 * Devices pull this whole so offline printing matches the office toggles.
 */
export async function fetchReceiptLayout(
  client: DoubleAClient,
): Promise<ReceiptLayout> {
  const { data, error } = await client
    .from("receipt_layout")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toReceiptLayout(data) : DEFAULT_RECEIPT_LAYOUT;
}

export async function updateReceiptLayout(
  client: DoubleAClient,
  patch: TablesUpdate<"receipt_layout">,
): Promise<ReceiptLayout> {
  const { data, error } = await client
    .from("receipt_layout")
    .update(patch)
    .select("*")
    .single();

  if (error) throw error;
  return toReceiptLayout(data);
}
