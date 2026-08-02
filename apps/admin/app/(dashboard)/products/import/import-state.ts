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
export interface ImportState extends FormState {
  csv: string;
  plan: ImportPlan | null;
  imported: number | null;
  skipped: number | null;
}

export const EMPTY_IMPORT_STATE: ImportState = {
  error: null,
  ok: false,
  csv: "",
  plan: null,
  imported: null,
  skipped: null,
};
