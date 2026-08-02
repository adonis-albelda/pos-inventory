"use client";

import { Fragment, useState } from "react";
import {
  CornerDownRight,
  Eye,
  EyeOff,
  Folder,
  Pencil,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge, Button, IconButton, Table, Td, Th } from "@/components/ui";
import type { CategoryOption } from "@/lib/category-options";
import { removeCategory, toggleCategoryActive } from "./actions";
import { CategoryForm } from "./category-form";

export function CategoriesTree({
  categories,
  productCounts,
}: {
  categories: CategoryOption[];
  /** How many products point at each category, for the delete warning. */
  productCounts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <Table>
      <thead>
        <tr>
          <Th>Category</Th>
          <Th>Full path</Th>
          <Th numeric>Products</Th>
          <Th>State</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {categories.map((category) => {
          const isEditing = editing === category.id;
          const isDeleting = deleting === category.id;
          const childCount = categories.filter(
            (other) => other.parentId === category.id,
          ).length;

          return (
            <Fragment key={category.id}>
              <tr className={category.isActive ? "" : "opacity-60"}>
                <Td>
                  <span
                    className="flex items-center gap-2"
                    style={{ paddingLeft: Math.min(category.depth, 4) * 12 }}
                  >
                    {category.depth > 0 ? (
                      <CornerDownRight size={14} className="shrink-0 text-ink-muted" />
                    ) : (
                      <Folder size={14} className="shrink-0 text-ink-muted" />
                    )}
                    <span className="font-medium">{category.name}</span>
                  </span>
                </Td>
                <Td className="text-ink-muted">{category.path}</Td>
                <Td numeric>{productCounts[category.id] ?? 0}</Td>
                <Td>
                  {category.isActive ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Hidden</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon={isEditing ? X : Pencil}
                      label={isEditing ? "Close editor" : "Rename or move"}
                      onClick={() => {
                        setDeleting(null);
                        setEditing(isEditing ? null : category.id);
                      }}
                    />
                    <form action={toggleCategoryActive}>
                      <input type="hidden" name="id" value={category.id} />
                      <input
                        type="hidden"
                        name="is_active"
                        value={String(!category.isActive)}
                      />
                      <IconButton
                        icon={category.isActive ? EyeOff : Eye}
                        label={category.isActive ? "Hide category" : "Show category"}
                        type="submit"
                      />
                    </form>
                    <IconButton
                      icon={Trash2}
                      label="Delete category"
                      tone="danger"
                      onClick={() => {
                        setEditing(null);
                        setDeleting(isDeleting ? null : category.id);
                      }}
                    />
                  </div>
                </Td>
              </tr>

              {isEditing ? (
                <tr>
                  <Td colSpan={5} className="border-l-2 border-l-primary bg-paper">
                    <CategoryForm
                      category={category}
                      categories={categories}
                      onDone={() => setEditing(null)}
                    />
                  </Td>
                </tr>
              ) : null}

              {isDeleting ? (
                <tr>
                  <Td colSpan={5} className="border-l-2 border-l-danger bg-danger/8">
                    <p className="flex items-start gap-2 text-body text-danger">
                      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                      <span>
                        Delete {category.path}?{" "}
                        {childCount > 0
                          ? `The ${childCount} ${childCount === 1 ? "category" : "categories"} nested under it go too. `
                          : ""}
                        {productCounts[category.id]
                          ? `${productCounts[category.id]} products keep the category name already on their receipts, but lose the link. `
                          : ""}
                        This cannot be undone.
                      </span>
                    </p>
                    <div className="mt-3 flex gap-2">
                      <form action={removeCategory}>
                        <input type="hidden" name="id" value={category.id} />
                        <Button variant="danger" size="sm" icon={Trash2} type="submit">
                          Yes, delete it
                        </Button>
                      </form>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDeleting(null)}
                      >
                        Keep category
                      </Button>
                    </div>
                  </Td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}
