import { listCategories } from "@double-a/api-client/queries";
import { toCategoryOptions } from "@/lib/category-options";
import { csvExport } from "@/lib/export-route";

export async function GET(): Promise<Response> {
  return csvExport("categories", async (client) => {
    const categories = toCategoryOptions(
      await listCategories(client, { includeInactive: true }),
    );

    return {
      headers: [
        "name",
        "path",
        "parent_path",
        "markup_percent",
        "markup_applied",
        "is_active",
      ],
      rows: categories.map((category) => {
        const parent = categories.find((entry) => entry.id === category.parentId);
        return [
          category.name,
          category.path,
          parent?.path ?? "",
          category.markupPercent,
          category.markupApplied,
          category.isActive,
        ];
      }),
    };
  });
}
