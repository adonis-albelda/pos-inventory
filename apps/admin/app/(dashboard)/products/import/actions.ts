"use server";

import { revalidatePath } from "next/cache";
import {
  createCategory,
  createProduct,
  listCategories,
  listProducts,
  updateProduct,
  type ProductInput,
} from "@double-a/api-client/queries";
import { ApiError, type ApiClient } from "@double-a/api-client";
import { toCategoryOptions } from "@/lib/category-options";
import { planProductImport, type ProductImportRow } from "@/lib/product-import";
import { getAuthedClient } from "@/lib/api/session";
import { EMPTY_IMPORT_STATE, type ImportRowFailure, type ImportState } from "./import-state";

/** Snake_case CSV row shape to the api-client's camelCase write shape. */
function toProductInput(row: ProductImportRow): ProductInput {
  return {
    name: row.name,
    sku: row.sku,
    price: row.price,
    costPrice: row.cost_price,
    categoryId: row.category_id,
    unit: row.unit,
    barcode: row.barcode,
    reorderPoint: row.reorder_point,
    bulkPrice: row.bulk_price,
    bulkMinQuantity: row.bulk_min_quantity,
    allowDecimal: row.allow_decimal,
    isActive: row.is_active,
  };
}

function describeRowError(error: unknown): string {
  if (error instanceof ApiError && error.isValidation) {
    const first = Object.values(error.errors ?? {})[0]?.[0];
    if (first) return first;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

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
  client: ApiClient,
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

    const created = await createCategory(client, { name: segment, parentId });
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

  const client = getAuthedClient();
  const [products, categories] = await Promise.all([
    listProducts(client, { includeInactive: true }),
    listCategories(client, { includeInactive: true }),
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

  const productIdBySku = new Map<string, string>();
  for (const product of products) {
    if (product.sku) productIdBySku.set(product.sku.toLowerCase(), product.id);
  }

  // GAP: the Tally API has no bulk upsert-by-SKU endpoint (the old flow was
  // a single Postgres upsert). Each accepted row is now its own
  // create/update call, so a failure on one row no longer aborts the whole
  // file — partial success is expected and surfaced below instead of one
  // all-or-nothing error.
  const failures: ImportRowFailure[] = [];
  let imported = 0;

  for (const row of accepted) {
    try {
      const values: ProductImportRow = { ...row.values! };
      if (row.categoryPath) {
        values.category_id = await ensureCategoryPath(client, row.categoryPath, idByPath);
      }

      const input = toProductInput(values);
      if (row.action === "update") {
        const id = productIdBySku.get(row.sku.toLowerCase());
        if (!id) throw new Error("That product could not be found anymore.");
        await updateProduct(client, id, input);
      } else {
        await createProduct(client, input);
      }
      imported += 1;
    } catch (error) {
      failures.push({ line: row.line, sku: row.sku, error: describeRowError(error) });
    }
  }

  if (imported > 0) {
    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/inventory");
    revalidatePath("/reports");
  }

  if (imported === 0) {
    return {
      ...EMPTY_IMPORT_STATE,
      csv,
      plan,
      error: "Nothing was imported. Every accepted row failed to save — see below.",
      failures,
    };
  }

  return {
    ...EMPTY_IMPORT_STATE,
    ok: true,
    error:
      failures.length > 0
        ? `${failures.length} row${failures.length === 1 ? "" : "s"} could not be saved — see below.`
        : null,
    imported,
    skipped: plan.rejectCount,
    failures: failures.length > 0 ? failures : null,
  };
}
