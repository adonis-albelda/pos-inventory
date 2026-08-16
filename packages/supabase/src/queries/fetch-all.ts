/**
 * PostgREST returns at most 1,000 rows unless the caller sends a Range.
 * Walk until a short page so a 4k catalogue is not silently truncated.
 */
export const POSTGREST_MAX_ROWS = 1000;

export async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const page = await loadPage(from, from + POSTGREST_MAX_ROWS - 1);
    rows.push(...page);
    if (page.length < POSTGREST_MAX_ROWS) return rows;
    from += POSTGREST_MAX_ROWS;
  }
}
