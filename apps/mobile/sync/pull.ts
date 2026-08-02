import type { PullResult } from "@double-a/shared-types";
import {
  fetchProductsChangedSince,
  fetchStoreSettings,
  fetchUsersChangedSince,
  listCategories,
  listCustomers,
} from "@double-a/supabase";
import { replaceCategories } from "@/db/categories";
import { replaceSyncedCustomers } from "@/db/customers";
import { getSyncMeta, recordSyncSuccess } from "@/db/meta";
import { upsertProducts } from "@/db/products";
import { saveLocalStoreSettings } from "@/db/store";
import { upsertUsers } from "@/db/users";
import { getSupabase } from "@/lib/supabase";

/**
 * Step two of sync: master data down from Supabase, overwriting local rows.
 *
 * Incremental — only rows whose `updated_at` is past the high water mark from the
 * last pull. The mark advances to the newest `updated_at` the server actually
 * returned, so a fast or slow device clock cannot cause the next pull to skip a
 * row. When nothing changed, the mark stays put.
 */
export async function pull(options: { full?: boolean } = {}): Promise<PullResult> {
  const supabase = getSupabase();
  const meta = await getSyncMeta();
  const since = options.full ? null : meta.highWaterMark;

  // Categories and customers come down whole every time, not since the high
  // water mark. Both tables stay small, and a wholesale fetch is the only way a
  // deleted row leaves this device — a "changed since" query returns nothing at
  // all for a row that no longer exists.
  //
  // The store settings row comes down whole for the same reason: it is one row,
  // and the header has to show the name the office is using today.
  const [products, users, categories, customers, store] = await Promise.all([
    fetchProductsChangedSince(supabase, since),
    fetchUsersChangedSince(supabase, since),
    listCategories(supabase),
    listCustomers(supabase),
    fetchStoreSettings(supabase),
  ]);

  // PIN hashes stay on the server — unlock calls verify_pin live. Local users
  // rows are for sale attribution after the shift starts, not credentials.
  await upsertProducts(products);
  await upsertUsers(users);
  await replaceCategories(categories);
  await replaceSyncedCustomers(customers);
  await saveLocalStoreSettings(store);

  // Categories, customers and the store row are deliberately absent from the
  // mark: they are fetched whole regardless, and letting a rename push the mark
  // forward would make the next pull skip product rows that changed in the same
  // moment.
  const timestamps = [
    ...products.map((product) => product.updatedAt),
    ...users.map((user) => user.updatedAt),
  ].filter(Boolean);

  const highWaterMark =
    timestamps.length > 0
      ? timestamps.reduce((latest, value) => (value > latest ? value : latest))
      : meta.highWaterMark;

  const finishedAt = new Date().toISOString();
  await recordSyncSuccess(finishedAt, highWaterMark);

  return {
    products: products.length,
    users: users.length,
    serverTimestamp: highWaterMark ?? finishedAt,
  };
}
