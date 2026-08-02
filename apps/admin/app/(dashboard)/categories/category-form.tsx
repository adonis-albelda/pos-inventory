"use client";

import { useActionState } from "react";
import { Check, FolderPlus } from "lucide-react";
import { Button, ErrorNote, Field, Input, Select, SuccessNote } from "@/components/ui";
import {
  descendantIds,
  indentLabel,
  type CategoryOption,
} from "@/lib/category-options";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { saveCategory } from "./actions";

export function CategoryForm({
  category,
  categories,
  onDone,
}: {
  category?: CategoryOption;
  categories: CategoryOption[];
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveCategory, EMPTY_FORM_STATE);

  // Moving a category under one of its own children would orphan the branch.
  const blocked = category ? descendantIds(categories, category.id) : new Set<string>();

  return (
    <form action={action} className="space-y-4">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            name="name"
            defaultValue={category?.name}
            placeholder="Pipes"
            required
          />
        </Field>
        <Field label="Sits under" hint="Leave as a top level to start a new branch.">
          <Select name="parent_id" defaultValue={category?.parentId ?? ""}>
            <option value="">Top level</option>
            {categories
              .filter((option) => !blocked.has(option.id))
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {indentLabel(option)}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? (
        <SuccessNote>
          Saved. Products under it now read the new path on their next sync.
        </SuccessNote>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          type="submit"
          loading={pending}
          icon={category ? Check : FolderPlus}
          className="w-full sm:w-auto"
        >
          {pending ? "Saving..." : category ? "Save changes" : "Add category"}
        </Button>
        {onDone ? (
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
