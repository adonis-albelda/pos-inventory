"use server";

import { revalidatePath } from "next/cache";
import { createCategory, deleteCategory, updateCategory } from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Renaming or re-parenting rewrites the flattened path on every product
 * underneath, which the database does in a trigger — so the products page and
 * the terminals are revalidated alongside this one.
 */
function revalidateCategoryViews() {
  revalidatePath("/categories");
  revalidatePath("/products");
  revalidatePath("/reports");
}

function describeError(message: string): string {
  if (message.includes("categories_sibling_name_idx")) {
    return "A category with that name already sits under the same parent.";
  }
  if (message.includes("nested inside itself")) {
    return "A category cannot be moved inside itself.";
  }
  return `Could not save the category: ${message}`;
}

export async function saveCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_id") ?? "").trim() || null;

  if (!name) return { error: "Give the category a name.", ok: false };
  if (id && parentId === id) {
    return { error: "A category cannot be its own parent.", ok: false };
  }

  const supabase = await getServerClient();

  try {
    if (id) {
      await updateCategory(supabase, id, { name, parent_id: parentId });
    } else {
      await createCategory(supabase, { name, parent_id: parentId });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: describeError(message), ok: false };
  }

  revalidateCategoryViews();
  return { error: null, ok: true };
}

export async function toggleCategoryActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";

  const supabase = await getServerClient();
  await updateCategory(supabase, id, { is_active: isActive });

  revalidateCategoryViews();
}

/**
 * Deleting takes every category nested underneath with it. Products keep the
 * category text already printed on their receipts and simply lose the link.
 */
export async function removeCategory(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");

  const supabase = await getServerClient();
  await deleteCategory(supabase, id);

  revalidateCategoryViews();
}
