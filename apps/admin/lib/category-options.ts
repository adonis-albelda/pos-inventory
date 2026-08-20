import { buildCategoryTree, flattenCategoryTree, type Category } from "@double-a/shared-types";

/**
 * The category tree as a flat, render-ready list. A server component may not
 * hand a client component the nested nodes without shipping every child twice,
 * so pages pass this shape instead.
 */
export interface CategoryOption {
  id: string;
  name: string;
  /** Full path, e.g. "Plumbing / Pipes / PVC". */
  path: string;
  depth: number;
  parentId: string | null;
  isActive: boolean;
  markupPercent: number;
  markupApplied: boolean;
}

export function toCategoryOptions(categories: Category[]): CategoryOption[] {
  return flattenCategoryTree(buildCategoryTree(categories)).map((node) => ({
    id: node.id,
    name: node.name,
    path: node.path,
    depth: node.depth,
    parentId: node.parentId,
    isActive: node.isActive,
    markupPercent: node.markupPercent,
    markupApplied: node.markupApplied,
  }));
}

/** Non-breaking spaces, so a <select> keeps the indent browsers would collapse. */
export function indentLabel(option: CategoryOption): string {
  return option.depth === 0
    ? option.name
    : `${"\u00A0\u00A0".repeat(option.depth)}— ${option.name}`;
}

/** A category may not be moved under itself or anything beneath it. */
export function descendantIds(options: CategoryOption[], id: string): Set<string> {
  const blocked = new Set([id]);

  // Options are in tree order, parents first, so one pass is enough.
  for (const option of options) {
    if (option.parentId && blocked.has(option.parentId)) blocked.add(option.id);
  }

  return blocked;
}

/**
 * Own counts plus everything nested underneath. Parents first in `options`,
 * so a reverse walk pushes each child's total up one level.
 */
export function rollupProductCounts(
  options: CategoryOption[],
  ownCounts: Record<string, number>,
): Record<string, number> {
  const rolled = { ...ownCounts };
  for (let i = options.length - 1; i >= 0; i--) {
    const option = options[i];
    if (!option?.parentId) continue;
    rolled[option.parentId] = (rolled[option.parentId] ?? 0) + (rolled[option.id] ?? 0);
  }
  return rolled;
}
