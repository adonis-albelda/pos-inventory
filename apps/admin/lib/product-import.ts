import type { Category, Product } from "@double-a/shared-types";
import {
  defaultAllowDecimal,
  formatMoney,
  isProductUnit,
  validateProductInput,
  type ProductUnit,
} from "@double-a/shared-types";
import { toCategoryOptions } from "@/lib/category-options";
import { parseCsvTable } from "@/lib/csv";

/**
 * Reading a price list from a supplier into the catalogue.
 *
 * Two rules shape everything here:
 *   * Stock is never in an import. It only ever moves through adjustStock(),
 *     so products.stock_quantity always equals the sum of its movements — and
 *     the row type below cannot even hold it.
 *   * A blank cell means "leave it as it is", never "set it to zero". Wiping a
 *     supplier price because a column was empty would quietly ruin every
 *     margin report.
 */

export const REQUIRED_COLUMNS = ["name", "sku", "price"] as const;

export const OPTIONAL_COLUMNS = [
  "cost_price",
  "unit",
  "allow_decimal",
  "barcode",
  "reorder_point",
  "bulk_price",
  "bulk_min_quantity",
  "category",
  "is_active",
] as const;

export const TEMPLATE_HEADERS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export const TEMPLATE_EXAMPLE = [
  "PVC pipe 1/2 inch x 3m",
  "PVC-050-3M",
  "185.00",
  "132.50",
  "pc",
  "false",
  "4806501234567",
  "12",
  "170.00",
  "10",
  "Plumbing / Pipes / PVC",
  "true",
];

const KNOWN_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

/**
 * Snake_case, matching the CSV columns and the field-by-field business logic
 * below. Structurally unable to carry stock or the trigger-owned category
 * path. `import/actions.ts` maps each accepted row to the api-client's
 * camelCase `ProductInput` right before calling `createProduct`/`updateProduct`.
 */
export interface ProductImportRow {
  name: string;
  sku: string;
  price: number;
  cost_price: number;
  unit: string;
  allow_decimal: boolean;
  barcode: string | null;
  reorder_point: number;
  bulk_price: number | null;
  bulk_min_quantity: number | null;
  category_id: string | null;
  is_active: boolean;
}

export type ImportAction = "create" | "update" | "reject";

export interface ImportRowPlan {
  /** Where it sits in the file, header counted as line 1. */
  line: number;
  name: string;
  sku: string;
  action: ImportAction;
  /** What will change, or why the row was turned away. */
  notes: string[];
  /** Null when rejected. `category_id` is resolved just before writing. */
  values: ProductImportRow | null;
  /** Non-null when the row names a category to attach the product to. */
  categoryPath: string | null;
}

export interface ImportPlan {
  rows: ImportRowPlan[];
  createCount: number;
  updateCount: number;
  rejectCount: number;
  /** Paths in the file that do not exist yet and would be created. */
  newCategoryPaths: string[];
  /** Columns nobody reads, listed so a typo in a header is visible. */
  unknownColumns: string[];
  /** Set when the whole file is unusable, e.g. a missing required column. */
  error: string | null;
}

const EMPTY_PLAN: ImportPlan = {
  rows: [],
  createCount: 0,
  updateCount: 0,
  rejectCount: 0,
  newCategoryPaths: [],
  unknownColumns: [],
  error: null,
};

function normalisePath(path: string): string {
  return path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}

function parseBoolean(raw: string): boolean | null {
  const value = raw.toLowerCase();
  if (["true", "yes", "y", "1", "active"].includes(value)) return true;
  if (["false", "no", "n", "0", "hidden", "inactive"].includes(value)) return false;
  return null;
}

export function planProductImport(
  csv: string,
  context: { products: Product[]; categories: Category[] },
): ImportPlan {
  const table = parseCsvTable(csv);

  if (table.headers.length === 0) {
    return { ...EMPTY_PLAN, error: "That file is empty." };
  }

  const missing = REQUIRED_COLUMNS.filter((column) => !table.headers.includes(column));
  if (missing.length > 0) {
    return {
      ...EMPTY_PLAN,
      error: `The file needs a ${missing.join(", ")} column. Download the template to see the layout.`,
    };
  }
  if (table.rows.length === 0) {
    return { ...EMPTY_PLAN, error: "That file has a header row but no products." };
  }

  const has = (column: string) => table.headers.includes(column);
  const unknownColumns = table.headers.filter((header) => !KNOWN_COLUMNS.has(header));

  const bySku = new Map<string, Product>();
  for (const product of context.products) {
    if (product.sku) bySku.set(product.sku.toLowerCase(), product);
  }

  const categoryIdByPath = new Map<string, string>();
  for (const option of toCategoryOptions(context.categories)) {
    categoryIdByPath.set(option.path.toLowerCase(), option.id);
  }

  const rows: ImportRowPlan[] = [];
  const newCategoryPaths: string[] = [];
  const seenSkus = new Set<string>();

  for (const { line, cells } of table.rows) {
    const cell = (column: string) => cells[column] ?? "";
    /** True only when the column exists and this row actually filled it in. */
    const given = (column: string) => has(column) && cell(column) !== "";

    const name = cell("name");
    const sku = cell("sku");
    const existing = sku ? bySku.get(sku.toLowerCase()) : undefined;
    const problems: string[] = [];

    if (!sku) {
      problems.push("A SKU is needed — it is what matches a row to a product.");
    } else if (seenSkus.has(sku.toLowerCase())) {
      problems.push("This SKU appears earlier in the file.");
    }
    if (sku) seenSkus.add(sku.toLowerCase());

    const price = Number(cell("price"));
    if (!given("price") || !Number.isFinite(price)) {
      problems.push("Price is missing or is not a number.");
    }

    // Blank optional cell: keep what the product already has, or fall back to
    // the same default a new product would get.
    const costPrice = given("cost_price")
      ? Number(cell("cost_price"))
      : (existing?.costPrice ?? 0);
    if (!Number.isFinite(costPrice)) problems.push("Supplier price is not a number.");

    const unit = given("unit")
      ? cell("unit").toLowerCase()
      : (existing?.unit ?? "pc");
    if (!isProductUnit(unit)) {
      problems.push(`"${cell("unit")}" is not a unit we sell by.`);
    }

    // Follows the unit for a new product unless the sheet says otherwise; an
    // existing product keeps its setting when the cell is blank.
    let allowDecimal = existing
      ? existing.allowDecimal
      : isProductUnit(unit)
        ? defaultAllowDecimal(unit as ProductUnit)
        : false;
    if (given("allow_decimal")) {
      const parsed = parseBoolean(cell("allow_decimal"));
      if (parsed === null) {
        problems.push(`"${cell("allow_decimal")}" is not a yes or no.`);
      } else {
        allowDecimal = parsed;
      }
    }

    const barcode = given("barcode") ? cell("barcode") : (existing?.barcode ?? null);

    const reorderPoint = given("reorder_point")
      ? Number(cell("reorder_point"))
      : (existing?.reorderPoint ?? 5);
    if (!Number.isInteger(reorderPoint)) {
      problems.push("Reorder point must be a whole number.");
    }

    // The pair moves together: filling in one and leaving the other blank is
    // rejected below rather than silently written as half a tier.
    const bulkPriceGiven = given("bulk_price");
    const bulkMinGiven = given("bulk_min_quantity");
    const bulkTouched = bulkPriceGiven || bulkMinGiven;

    const bulkPrice = bulkPriceGiven
      ? Number(cell("bulk_price"))
      : bulkTouched
        ? null
        : (existing?.bulkPrice ?? null);
    const bulkMinQuantity = bulkMinGiven
      ? Number(cell("bulk_min_quantity"))
      : bulkTouched
        ? null
        : (existing?.bulkMinQuantity ?? null);

    let isActive = existing?.isActive ?? true;
    if (given("is_active")) {
      const parsed = parseBoolean(cell("is_active"));
      if (parsed === null) {
        problems.push(`"${cell("is_active")}" is not a yes or no.`);
      } else {
        isActive = parsed;
      }
    }

    const categoryPath = given("category") ? normalisePath(cell("category")) : null;

    const validation = validateProductInput({
      name,
      price,
      sku,
      costPrice: Number.isFinite(costPrice) ? costPrice : undefined,
      reorderPoint: Number.isInteger(reorderPoint) ? reorderPoint : undefined,
      bulkPrice,
      bulkMinQuantity,
      unit,
    });
    problems.push(...validation.errors);

    if (problems.length > 0) {
      rows.push({
        line,
        name,
        sku,
        action: "reject",
        notes: [...new Set(problems)],
        values: null,
        categoryPath,
      });
      continue;
    }

    if (categoryPath && !categoryIdByPath.has(categoryPath.toLowerCase())) {
      if (!newCategoryPaths.includes(categoryPath)) newCategoryPaths.push(categoryPath);
    }

    const values: ProductImportRow = {
      name,
      sku,
      price,
      cost_price: costPrice,
      unit,
      allow_decimal: allowDecimal,
      barcode,
      reorder_point: reorderPoint,
      bulk_price: bulkPrice,
      bulk_min_quantity: bulkMinQuantity,
      category_id: existing?.categoryId ?? null,
      is_active: isActive,
    };

    rows.push({
      line,
      name,
      sku,
      action: existing ? "update" : "create",
      notes: existing
        ? describeChanges(existing, values, categoryPath)
        : ["New product. Its stock starts at zero — record it in Inventory."],
      values,
      categoryPath,
    });
  }

  return {
    rows,
    createCount: rows.filter((row) => row.action === "create").length,
    updateCount: rows.filter((row) => row.action === "update").length,
    rejectCount: rows.filter((row) => row.action === "reject").length,
    newCategoryPaths,
    unknownColumns,
    error: null,
  };
}

function describeChanges(
  existing: Product,
  values: ProductImportRow,
  categoryPath: string | null,
): string[] {
  const changes: string[] = [];

  if (existing.name !== values.name) changes.push(`Name → ${values.name}`);
  if (existing.price !== values.price) {
    changes.push(
      `Shelf price ${formatMoney(existing.price)} → ${formatMoney(values.price)}`,
    );
  }
  if (existing.costPrice !== values.cost_price) {
    changes.push(
      `Supplier price ${formatMoney(existing.costPrice)} → ${formatMoney(values.cost_price ?? 0)}`,
    );
  }
  if (existing.unit !== values.unit) changes.push(`Sold by → ${values.unit}`);
  if (existing.allowDecimal !== (values.allow_decimal ?? false)) {
    changes.push(
      values.allow_decimal ? "Decimal quantities on" : "Decimal quantities off",
    );
  }
  if (existing.barcode !== values.barcode) changes.push("Barcode changes");
  if (existing.reorderPoint !== values.reorder_point) {
    changes.push(`Reorder point ${existing.reorderPoint} → ${values.reorder_point}`);
  }
  const bulkPrice = values.bulk_price ?? null;
  if (
    existing.bulkPrice !== bulkPrice ||
    existing.bulkMinQuantity !== (values.bulk_min_quantity ?? null)
  ) {
    changes.push(
      bulkPrice === null
        ? "Bulk price removed"
        : `Bulk price ${formatMoney(bulkPrice)} from ${values.bulk_min_quantity}`,
    );
  }
  if (existing.isActive !== values.is_active) {
    changes.push(values.is_active ? "Shown on terminals" : "Hidden from terminals");
  }
  if (categoryPath && categoryPath.toLowerCase() !== (existing.category ?? "").toLowerCase()) {
    changes.push(`Category → ${categoryPath}`);
  }

  return changes.length > 0 ? changes : ["Nothing changes for this one."];
}
