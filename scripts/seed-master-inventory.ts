/**
 * Seed one company's catalog from MASTER INVENTORY LIST.csv.
 * Idempotent. Stock only via inventory_movements — never products.stock_quantity.
 *
 *   pnpm seed-master-inventory
 *
 * Needs repo-root .env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_COMPANY_ID (optional; default is the shop this file was built for)
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@double-a/supabase/types";

const DEFAULT_COMPANY_ID = "19f9b6a5-73ec-4768-981a-8af6156f19af";
const OPENING_NOTE = "opening stock (MASTER INVENTORY LIST)";
const CSV_NAME = "MASTER INVENTORY LIST.csv";
const BATCH = 200;
const PAGE = 1000;
const EXPECTED_COLUMNS = 13;

const COL = {
  sku: 0,
  name: 1,
  qty: 5,
  price: 6,
  cost: 7,
  category: 8,
  supplier: 9,
} as const;

type Service = SupabaseClient<Database>;

interface CsvRow {
  line: number;
  rawSku: string;
  sku: string;
  name: string;
  qty: number;
  allowDecimal: boolean;
  price: number;
  cost: number;
  category: string | null;
  supplier: string | null;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchAll<Row>(
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Excel all-quoted export. Inch marks inside names are not RFC4180-safe. */
function parseQuotedRow(line: string): string[] {
  let text = line.replace(/\r$/, "");
  if (text.endsWith(",")) text = text.slice(0, -1);
  if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
  return text.split('","').map((cell) => cell.replaceAll('""', '"').trim());
}

function parseNumber(raw: string): number | null {
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function uniqueNames(names: (string | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const name of names) {
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}

function assignSkus(rows: CsvRow[]): string[] {
  const used = new Set<string>();
  const suffixes: string[] = [];
  for (const row of rows) {
    let sku = row.rawSku;
    let n = 2;
    while (used.has(sku.toLowerCase())) {
      sku = `${row.rawSku}-${n}`;
      n += 1;
    }
    used.add(sku.toLowerCase());
    if (sku !== row.rawSku) {
      suffixes.push(`line ${row.line}: ${row.rawSku} -> ${sku} (${row.name})`);
    }
    row.sku = sku;
  }
  return suffixes;
}

function parseCsv(text: string): { rows: CsvRow[]; skipped: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split("\n");
  const skipped: string[] = [];
  const rows: CsvRow[] = [];

  if (lines.length === 0) throw new Error(`${CSV_NAME} is empty.`);

  const header = parseQuotedRow(lines[0] ?? "");
  if (header[0] !== "ItemCode") {
    throw new Error(`${CSV_NAME} header should start with ItemCode, got ${header[0] ?? "(empty)"}.`);
  }

  for (let i = 1; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    if (!raw.trim()) continue;

    const cells = parseQuotedRow(raw);
    if (cells.length === 1 && cells[0]?.toLowerCase().startsWith("powered by")) {
      skipped.push(`line ${lineNo}: footer`);
      continue;
    }
    if (cells.length !== EXPECTED_COLUMNS) {
      skipped.push(`line ${lineNo}: expected ${EXPECTED_COLUMNS} columns, got ${cells.length}`);
      continue;
    }

    const rawSku = cells[COL.sku] ?? "";
    const name = cells[COL.name] ?? "";
    if (!rawSku || !name) {
      skipped.push(`line ${lineNo}: missing SKU or name`);
      continue;
    }

    const price = parseNumber(cells[COL.price] ?? "");
    const cost = parseNumber(cells[COL.cost] ?? "");
    const qtyRaw = parseNumber(cells[COL.qty] ?? "");
    if (price === null || price < 0) {
      skipped.push(`line ${lineNo}: ${rawSku} bad price`);
      continue;
    }
    if (cost === null || cost < 0) {
      skipped.push(`line ${lineNo}: ${rawSku} bad cost`);
      continue;
    }
    if (qtyRaw === null) {
      skipped.push(`line ${lineNo}: ${rawSku} bad qty`);
      continue;
    }

    const qty = roundQty(qtyRaw);
    const category = cells[COL.category] ?? "";
    const supplier = cells[COL.supplier] ?? "";

    rows.push({
      line: lineNo,
      rawSku,
      sku: rawSku,
      name,
      qty,
      allowDecimal: !Number.isInteger(qty),
      price,
      cost,
      category: category || null,
      supplier: supplier && supplier !== "0" ? supplier : null,
    });
  }

  return { rows, skipped };
}

async function ensureNamedRows(
  service: Service,
  table: "categories" | "suppliers",
  companyId: string,
  names: string[],
  extra: Record<string, unknown>,
): Promise<Map<string, string>> {
  const existing = await fetchAll<{ id: string; name: string }>((from, to) => {
    let query = service.from(table).select("id, name").eq("company_id", companyId);
    if (table === "categories") query = query.is("parent_id", null);
    return query.range(from, to);
  });

  const byName = new Map<string, string>();
  for (const row of existing) byName.set(row.name.trim().toLowerCase(), row.id);

  const missing = names.filter((name) => !byName.has(name.toLowerCase()));
  for (const batch of chunk(missing, BATCH)) {
    const payload = batch.map((name) => ({
      id: randomUUID(),
      company_id: companyId,
      name,
      ...extra,
    }));
    const { data, error } = await service.from(table).insert(payload).select("id, name");
    if (error) throw new Error(`${table} insert: ${error.message}`);
    for (const row of data ?? []) byName.set(row.name.trim().toLowerCase(), row.id);
  }

  return byName;
}

async function main(): Promise<void> {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const companyId = process.env.SEED_COMPANY_ID?.trim() || DEFAULT_COMPANY_ID;

  const service = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: company, error: companyError } = await service
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new Error(`Company ${companyId} not found.`);

  const csvPath = join(dirname(fileURLToPath(import.meta.url)), "..", CSV_NAME);
  const { rows, skipped } = parseCsv(await readFile(csvPath, "utf8"));
  const suffixes = assignSkus(rows);

  console.log(`Company ${company.name} (${company.id}).`);
  console.log(`Parsed ${rows.length} products from ${CSV_NAME}.`);

  const categoryNames = uniqueNames(rows.map((row) => row.category));
  const supplierNames = uniqueNames(rows.map((row) => row.supplier));

  const categories = await ensureNamedRows(service, "categories", companyId, categoryNames, {
    parent_id: null,
  });
  const suppliers = await ensureNamedRows(service, "suppliers", companyId, supplierNames, {});

  const existingProducts = await fetchAll<{ id: string; sku: string | null }>((from, to) =>
    service.from("products").select("id, sku").eq("company_id", companyId).range(from, to),
  );
  const productIdBySku = new Map<string, string>();
  for (const product of existingProducts) {
    if (product.sku) productIdBySku.set(product.sku.toLowerCase(), product.id);
  }

  const productRows = rows.map((row) => {
    const id = productIdBySku.get(row.sku.toLowerCase()) ?? randomUUID();
    productIdBySku.set(row.sku.toLowerCase(), id);
    return {
      id,
      company_id: companyId,
      name: row.name,
      sku: row.sku,
      price: row.price,
      cost_price: row.cost,
      category_id: row.category ? (categories.get(row.category.toLowerCase()) ?? null) : null,
      unit: "pc" as const,
      allow_decimal: row.allowDecimal,
      is_active: true,
      csv: row,
    };
  });

  const existingIds = new Set(existingProducts.map((product) => product.id));
  let created = 0;
  let updated = 0;
  for (const batch of chunk(productRows, BATCH)) {
    const payload = batch.map(({ csv: _csv, ...product }) => product);
    const { error } = await service.from("products").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(`products upsert: ${error.message}`);
    for (const row of batch) {
      if (existingIds.has(row.id)) updated += 1;
      else created += 1;
    }
  }

  const links = productRows
    .map((row) => {
      const supplierName = row.csv.supplier;
      if (!supplierName) return null;
      const supplierId = suppliers.get(supplierName.toLowerCase());
      if (!supplierId) return null;
      return { company_id: companyId, supplier_id: supplierId, product_id: row.id };
    })
    .filter((row): row is { company_id: string; supplier_id: string; product_id: string } => !!row);

  for (const batch of chunk(links, BATCH)) {
    const { error } = await service.from("supplier_products").upsert(batch, {
      onConflict: "supplier_id,product_id",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`supplier_products upsert: ${error.message}`);
  }

  const seededMovements = await fetchAll<{ product_id: string }>((from, to) =>
    service
      .from("inventory_movements")
      .select("product_id")
      .eq("company_id", companyId)
      .eq("note", OPENING_NOTE)
      .range(from, to),
  );
  const alreadyStocked = new Set(seededMovements.map((row) => row.product_id));

  const movements = productRows.flatMap((row) => {
    if (row.csv.qty === 0) return [];
    if (alreadyStocked.has(row.id)) return [];
    return [
      {
        company_id: companyId,
        product_id: row.id,
        change_quantity: row.csv.qty,
        reason: row.csv.qty > 0 ? "restock" : "adjustment",
        note: OPENING_NOTE,
      },
    ];
  });

  let movementCount = 0;
  for (const batch of chunk(movements, BATCH)) {
    const { error } = await service.from("inventory_movements").insert(batch);
    if (error) throw new Error(`inventory_movements insert: ${error.message}`);
    movementCount += batch.length;
  }

  if (suffixes.length > 0) {
    console.log(`SKU suffixes (${suffixes.length}):`);
    for (const line of suffixes) console.log(`  ${line}`);
  }
  if (skipped.length > 0) {
    console.log(`Skipped (${skipped.length}):`);
    for (const line of skipped) console.log(`  ${line}`);
  }

  console.log(
    `Categories ${categoryNames.length}. Suppliers ${supplierNames.length}. Products created ${created}, updated ${updated}. Opening movements ${movementCount}.`,
  );
  console.log("Done.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
