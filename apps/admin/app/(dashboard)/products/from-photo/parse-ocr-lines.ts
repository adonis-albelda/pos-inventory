import { randomUUID } from "node:crypto";
import { isProductUnit } from "@double-a/shared-types";
import type { ScannedProductDraft } from "./types";

/**
 * Turns raw OCR text (one product per line) into editable drafts.
 *
 * Typical notebook lines:
 *   PVC pipe 1/2 x 3m  185.00
 *   SKU-001  Cement 50kg  320
 *   Widget — 45 / 30
 *
 * Trailing numbers become shelf price (and optional supplier cost). Leading
 * token that looks like a SKU is peeled off. Category path matching is best
 * effort against known catalogue paths.
 */

const PRICE_TAIL =
  /(?:^|\s)(?:₱|P|Php)?\s*(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:\/\s*(?:₱|P|Php)?\s*(\d{1,7}(?:[.,]\d{1,2})?))?\s*$/i;

const SKU_LEAD = /^([A-Za-z0-9][A-Za-z0-9._/-]{1,31})\s+(.+)$/;

function parseMoney(raw: string): string {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? String(n) : "";
}

function matchCategoryId(
  haystack: string,
  options: { id: string; name: string; path: string }[],
): string {
  const lower = haystack.toLowerCase();
  if (!lower.trim()) return "";

  const byPath = options.find((o) => lower.includes(o.path.toLowerCase()));
  if (byPath) return byPath.id;

  const byName = options.find(
    (o) => o.name.length > 2 && lower.includes(o.name.toLowerCase()),
  );
  if (byName) return byName.id;

  return "";
}

function peelUnit(name: string): { name: string; unit: string } {
  const match = name.match(/\b(pc|pcs|box|set|pack|roll|sheet|m|ft|kg|l|gal|bag)\b\.?$/i);
  if (!match) return { name: name.trim(), unit: "pc" };
  const raw = match[1]!.toLowerCase().replace(/s$/, "");
  const unit = raw === "pc" || isProductUnit(raw) ? (raw === "pc" ? "pc" : raw) : "pc";
  // "pcs" → peels to "pc"
  const cleaned = name.slice(0, match.index).trim();
  return { name: cleaned || name.trim(), unit: isProductUnit(unit) ? unit : "pc" };
}

export function parseOcrProductLines(
  text: string,
  categories: { id: string; name: string; path: string }[],
): ScannedProductDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[|•·]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 2);

  const drafts: ScannedProductDraft[] = [];

  for (const line of lines) {
    // Skip obvious headers / totals.
    if (/^(name|sku|price|item|product|qty|quantity|total|subtotal)\b/i.test(line)) {
      continue;
    }
    if (/^[\d.\s/-]+$/.test(line)) continue;

    let rest = line;
    let price = "";
    let costPrice = "";

    const priceMatch = rest.match(PRICE_TAIL);
    if (priceMatch && priceMatch.index !== undefined) {
      price = parseMoney(priceMatch[1]!);
      if (priceMatch[2]) costPrice = parseMoney(priceMatch[2]);
      // If two prices and first looks larger as shelf, keep as-is; if OCR put
      // cost second after "/", treat second as cost.
      rest = rest.slice(0, priceMatch.index).trim();
    }

    let sku = "";
    const skuMatch = rest.match(SKU_LEAD);
    if (skuMatch) {
      const candidate = skuMatch[1]!;
      // SKU-ish: has digit or hyphen/slash, not a plain English word alone.
      if (/[0-9/_-]/.test(candidate) || candidate === candidate.toUpperCase()) {
        sku = candidate;
        rest = skuMatch[2]!;
      }
    }

    const { name, unit } = peelUnit(rest.replace(/[-–—:]+$/g, "").trim());
    if (!name) continue;

    // A line that is only a price leftover after peeling is noise.
    if (/^\d+(\.\d+)?$/.test(name)) continue;

    drafts.push({
      clientId: randomUUID(),
      name,
      sku,
      barcode: "",
      price,
      costPrice,
      categoryId: matchCategoryId(line, categories),
      unit,
      reorderPoint: "5",
      bulkPrice: "",
      bulkMinQuantity: "",
    });
  }

  return drafts;
}
