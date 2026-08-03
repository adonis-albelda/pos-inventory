"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UI_MODE_COOKIE, type UiMode } from "@/lib/ui-mode";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setUiMode(formData: FormData): Promise<void> {
  const mode: UiMode =
    String(formData.get("mode") ?? "") === "classic" ? "classic" : "modern";

  const store = await cookies();
  store.set(UI_MODE_COOKIE, mode, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
