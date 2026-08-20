import type { FormState } from "@/lib/form-state";
import type { ImportPlan } from "@/lib/product-import";

/**
 * An import is two steps: read the file and show what it would do, then write
 * it. The file itself is carried between them so the confirm step re-reads the
 * very same rows rather than trusting a summary the browser sent back.
 *
 * Lives outside actions.ts because a "use server" module may only export
 * async functions.
 */

/**
 * A row that passed the plan's own validation (see `ImportRowPlan`) but
 * failed on the actual write to the API — a real possibility now that each
 * accepted row is its own `createProduct`/`updateProduct` call instead of
 * one atomic upsert. Distinct from `skipped`, which counts rows rejected
 * before any write was attempted.
 */
export interface ImportRowFailure {
  line: number;
  sku: string;
  error: string;
}

export interface ImportState extends FormState {
  csv: string;
  plan: ImportPlan | null;
  imported: number | null;
  skipped: number | null;
  failures: ImportRowFailure[] | null;
}

export const EMPTY_IMPORT_STATE: ImportState = {
  error: null,
  ok: false,
  csv: "",
  plan: null,
  imported: null,
  skipped: null,
  failures: null,
};
