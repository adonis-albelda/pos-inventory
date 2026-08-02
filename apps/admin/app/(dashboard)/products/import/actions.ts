"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  listCategories,
  listProducts,
  upsertProductsBySku,
  type DoubleAClient,
} from "@double-a/supabase";
import { toCategoryOptions } from "@/lib/category-options";
import { planProductImport, type ProductImportRow } from "@/lib/product-import";
import { getServerClient } from "@/lib/supabase/server";
import { EMPTY_IMPORT_STATE, type ImportState } from "./import-state";

async function readUpload(formData: FormData): Promise<string> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) return file.text();
  return String(formData.get("pasted") ?? "");
}

/**
 * Walks a path like "Plumbing / Pipes / PVC", creating whatever level is
 * missing, and hands back the id of the deepest one.
 */
async function ensureCategoryPath(
  client: DoubleAClient,
  path: string,
  idByPath: Map<string, string>,
): Promise<string | null> {
  let parentId: string | null = null;
  let walked = "";

  for (const segment of path.split(" / ")) {
    walked = walked ? `${walked} / ${segment}` : segment;

    const known = idByPath.get(walked.toLowerCase());
    if (known) {
      parentId = known;
      continue;
    }

    const created = await createCategory(client, { name: segment, parent_id: parentId });
    idByPath.set(walked.toLowerCase(), created.id);
    parentId = created.id;
  }

  return parentId;
}

/**
 * Both steps of the import run through here — checking the file and, on a
 * second deliberate submit, writing it. One action means one piece of state,
 * so a stale error from an earlier attempt can never sit next to a fresh
 * preview.
 */
export async function importProducts(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const writing = String(formData.get("intent") ?? "") === "import";
  const csv = writing ? String(formData.get("csv") ?? "") : await readUpload(formData);

  if (!csv.trim()) {
    return {
      ...EMPTY_IMPORT_STATE,
      error: writing
        ? "The file was lost. Upload it again."
        : "Choose a CSV file, or paste the rows.",
    };
  }

  const supabase = await getServerClient();
  const [products, categories] = await Promise.all([
    listProducts(supabase, { includeInactive: true }),
    listCategories(supabase, { includeInactive: true }),
  ]);

  // Planned from the file both times, never from anything the browser posted
  // back, so what was previewed cannot be edited into a different write.
  const plan = planProductImport(csv, { products, categories });
  if (plan.error) return { ...EMPTY_IMPORT_STATE, error: plan.error };

  if (!writing) return { ...EMPTY_IMPORT_STATE, csv, plan };

  const accepted = plan.rows.filter((row) => row.values !== null);
  if (accepted.length === 0) {
    return {
      ...EMPTY_IMPORT_STATE,
      csv,
      plan,
      error: "Every row was turned away. Fix the ones listed and upload again.",
    };
  }

  const idByPath = new Map<string, string>();
  for (const option of toCategoryOptions(categories)) {
    idByPath.set(option.path.toLowerCase(), option.id);
  }

  const rows: ProductImportRow[] = [];

  try {
    for (const row of accepted) {
      const values = { ...row.values! };
      if (row.categoryPath) {
        values.category_id = await ensureCategoryPath(
          supabase,
          row.categoryPath,
          idByPath,
        );
      }
      rows.push(values);
    }

    await upsertProductsBySku(supabase, rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ...EMPTY_IMPORT_STATE,
      csv,
      plan,
      error: message.includes("products_barcode_idx")
        ? "Two products cannot share a barcode. Check the barcode column and upload again."
        : `Nothing was imported: ${message}`,
    };
  }

  revalidatePath("/products");
  revalidatePath("/categories");
  revalidatePath("/inventory");
  revalidatePath("/reports");

  return {
    ...EMPTY_IMPORT_STATE,
    ok: true,
    imported: rows.length,
    skipped: plan.rejectCount,
  };
}
