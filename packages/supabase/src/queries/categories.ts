import type { Category, CategoryNode } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate } from "../database.types";
import { toCategory } from "../mappers";

/**
 * Every category the office keeps. Also what a mobile pull takes down whole:
 * the table is small, and fetching it whole is the only way a device learns a
 * category was deleted, since an incremental query returns nothing for a row
 * that no longer exists.
 */
export async function listCategories(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<Category[]> {
  let query = client.from("categories").select("*").order("name");
  if (!options.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toCategory);
}

export async function createCategory(
  client: DoubleAClient,
  input: TablesInsert<"categories">,
): Promise<Category> {
  const { data, error } = await client
    .from("categories")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return toCategory(data);
}

export async function updateCategory(
  client: DoubleAClient,
  id: string,
  patch: TablesUpdate<"categories">,
): Promise<Category> {
  const { data, error } = await client
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toCategory(data);
}

/**
 * Deleting cascades to child categories; products under them keep their
 * flattened path text and simply lose the link, so nothing on a receipt or in
 * a past report changes.
 */
export async function deleteCategory(
  client: DoubleAClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("categories").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Flat rows to a tree, sorted by name at every level. Orphans (a parent that
 * was filtered out as inactive) are promoted to roots rather than dropped —
 * losing a category would silently hide its products.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const category of categories) {
    byId.set(category.id, { ...category, path: category.name, depth: 0, children: [] });
  }

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const settle = (nodes: CategoryNode[], depth: number, prefix: string) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      node.depth = depth;
      node.path = prefix ? `${prefix} / ${node.name}` : node.name;
      settle(node.children, depth + 1, node.path);
    }
  };

  settle(roots, 0, "");
  return roots;
}

/** The tree flattened back into render order, parents before their children. */
export function flattenCategoryTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}
