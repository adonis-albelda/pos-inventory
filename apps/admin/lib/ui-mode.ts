import { cookies } from "next/headers";

/**
 * Two chromes over the same pages. "classic" is the desktop-launcher look most
 * owners know from older till software, so it is the default; it changes
 * navigation only, never data.
 */
export type UiMode = "modern" | "classic";

export const UI_MODE_COOKIE = "admin_ui_mode";

export async function getUiMode(): Promise<UiMode> {
  const store = await cookies();
  return store.get(UI_MODE_COOKIE)?.value === "modern" ? "modern" : "classic";
}
