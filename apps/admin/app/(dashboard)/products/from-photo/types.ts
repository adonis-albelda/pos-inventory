/**
 * One product line read from a notebook photo, before the owner saves it.
 * Stock is never here — counts only move through Inventory.
 */
export interface ScannedProductDraft {
  /** Stable React key; not a DB id. */
  clientId: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
  costPrice: string;
  categoryId: string;
  unit: string;
  reorderPoint: string;
  bulkPrice: string;
  bulkMinQuantity: string;
}

export interface ExtractProductsResult {
  error: string | null;
  drafts: ScannedProductDraft[];
}

export interface SaveScannedResult {
  error: string | null;
  ok: boolean;
  /** clientId that was saved, so the UI can drop that row. */
  clientId: string | null;
}

export interface SaveAllScannedResult {
  error: string | null;
  /** How many rows landed in the catalogue. */
  saved: number;
  /** clientIds that failed, with the reason. */
  failures: { clientId: string; error: string }[];
}
