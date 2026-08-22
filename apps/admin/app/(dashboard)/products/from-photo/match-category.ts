/**
 * Best-effort category match for a line read off a notebook photo. OCR and
 * line-parsing both moved server-side (ExtractProductsFromPhotoAction, the
 * Laravel API) — this is the one piece that stays here, since it needs the
 * tenant's own category tree, which the API has no reason to load for an
 * OCR endpoint.
 */
export function matchCategoryId(
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
