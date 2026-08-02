"use server";

import { revalidatePath } from "next/cache";
import { updateStoreSettings, uploadStoreLogo } from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

/** Comfortably past any real shop logo, well under the server action body cap. */
const MAX_LOGO_BYTES = 1_000_000;

const LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Blank stays blank: an empty box means "nothing to print", not an empty string. */
function optional(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

export async function saveStoreSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "The shop name is required — it heads every terminal.", ok: false };
  }

  const logo = formData.get("logo");
  const file = logo instanceof File && logo.size > 0 ? logo : null;
  const removeLogo = String(formData.get("remove_logo") ?? "") === "on";

  if (file) {
    if (!LOGO_EXTENSIONS[file.type]) {
      return { error: "The logo must be a PNG, JPEG, WebP or SVG image.", ok: false };
    }
    if (file.size > MAX_LOGO_BYTES) {
      return { error: "The logo must be under 1 MB.", ok: false };
    }
  }

  const supabase = await getServerClient();

  try {
    // Uploaded first: if storage refuses the file, the row is left alone rather
    // than pointing at a URL that was never written.
    const logoUrl = file
      ? await uploadStoreLogo(supabase, file, LOGO_EXTENSIONS[file.type]!)
      : null;

    await updateStoreSettings(supabase, {
      name,
      address: optional(formData, "address"),
      phone: optional(formData, "phone"),
      receipt_footer: optional(formData, "receipt_footer"),
      // Three cases, and only two of them touch the column: a new file replaces
      // it, "remove" clears it, and neither leaves whatever is there.
      ...(logoUrl ? { logo_url: logoUrl } : removeLogo ? { logo_url: null } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Could not save: ${message}`, ok: false };
  }

  revalidatePath("/settings");
  // The sidebar reads the shop name, and it is rendered by the dashboard layout.
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}
