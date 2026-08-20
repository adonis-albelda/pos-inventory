"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Info, TriangleAlert } from "lucide-react";
import type { Product } from "@double-a/shared-types";
import {
  defaultAllowDecimal,
  formatMoney,
  formatPercent,
  isProductUnit,
  marginPercent,
  PRODUCT_UNITS,
  shelfPriceFromMarkup,
  UNIT_LABELS,
} from "@double-a/shared-types";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  SuccessNote,
} from "@/components/ui";
import { indentLabel, type CategoryOption } from "@/lib/category-options";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { useInvalidateProducts } from "@/lib/query/products";
import { saveProduct } from "./actions";

export function ProductForm({
  product,
  categories,
  onDone,
}: {
  product?: Product;
  categories: CategoryOption[];
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveProduct, EMPTY_FORM_STATE);
  const invalidate = useInvalidateProducts();

  // Held in state only so the owner can see what they make on the item while
  // they are still typing the price.
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [costPrice, setCostPrice] = useState(product ? String(product.costPrice) : "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");

  // The decimal toggle follows the unit until the owner touches it — a product
  // sold by the metre defaults to allowing fractions, a boxed one does not.
  const [unit, setUnit] = useState(product?.unit ?? "pc");
  const [allowDecimal, setAllowDecimal] = useState(
    product?.allowDecimal ?? defaultAllowDecimal("pc"),
  );
  const [decimalTouched, setDecimalTouched] = useState(false);

  function onUnitChange(next: string) {
    if (!isProductUnit(next)) return;
    setUnit(next);
    if (!decimalTouched) setAllowDecimal(defaultAllowDecimal(next));
  }

  useEffect(() => {
    if (state.ok) {
      invalidate();
      onDone?.();
    }
    // invalidate is stable enough for this effect; only state.ok/onDone gate re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, onDone]);

  const priceValue = Number(price);
  const costValue = Number(costPrice);
  const bothSet = price !== "" && costPrice !== "" && Number.isFinite(priceValue) && Number.isFinite(costValue);
  const belowCost = bothSet && priceValue < costValue;
  const selectedCategory = categories.find((entry) => entry.id === categoryId);

  function applyCategoryMarkup(nextCategoryId: string, nextCost: string) {
    const category = categories.find((entry) => entry.id === nextCategoryId);
    const cost = Number(nextCost);
    if (!category?.markupApplied || !Number.isFinite(cost) || nextCost === "") return;
    setPrice(String(shelfPriceFromMarkup(cost, category.markupPercent)));
  }

  return (
    <form action={action} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Name">
          <Input name="name" defaultValue={product?.name} required />
        </Field>
        <Field label="SKU" hint="Optional, must be unique. Used to match CSV imports.">
          <Input name="sku" defaultValue={product?.sku ?? ""} />
        </Field>
        <Field label="Barcode" hint="Optional. Scanned at the counter.">
          <Input name="barcode" defaultValue={product?.barcode ?? ""} />
        </Field>

        <Field label="Supplier price" hint="What you pay for it.">
          <Input
            name="cost_price"
            type="number"
            step="0.01"
            min="0"
            value={costPrice}
            onChange={(event) => {
              const next = event.target.value;
              setCostPrice(next);
              applyCategoryMarkup(categoryId, next);
            }}
            required
          />
        </Field>
        <Field label="Shelf price" hint="What the customer pays.">
          <Input
            name="price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
          />
        </Field>
        <div className="self-end">
          <div className="rounded-sm border border-border bg-paper px-3 py-2">
            <p className="text-caption font-medium text-ink-muted">You make</p>
            {bothSet ? (
              <p
                className={[
                  "num mt-0.5 text-body-lg font-semibold",
                  belowCost ? "text-danger" : "text-ink",
                ].join(" ")}
              >
                {formatMoney(priceValue - costValue)}{" "}
                <span className="text-body font-medium text-ink-muted">
                  ({formatPercent(marginPercent(priceValue, costValue))} margin)
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-body text-ink-muted">
                Fill both prices to see the margin.
              </p>
            )}
          </div>
        </div>

        <Field
          label="Category"
          hint={
            selectedCategory?.markupApplied
              ? `Markup ${selectedCategory.markupPercent}% fills shelf from cost.`
              : undefined
          }
        >
          <Select
            name="category_id"
            value={categoryId}
            onChange={(event) => {
              const next = event.target.value;
              setCategoryId(next);
              applyCategoryMarkup(next, costPrice);
            }}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {indentLabel(category)}
                {category.isActive ? "" : " (hidden)"}
                {category.markupApplied ? ` (+${category.markupPercent}%)` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sold by">
          <Select
            name="unit"
            value={unit}
            onChange={(event) => onUnitChange(event.target.value)}
          >
            {PRODUCT_UNITS.map((option) => (
              <option key={option} value={option}>
                {UNIT_LABELS[option] ?? option}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Quantity mode"
          hint={
            allowDecimal
              ? "Sold and stocked in fractions (e.g. 2.5)."
              : "Whole numbers only."
          }
        >
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-3 sm:h-10">
            <input
              type="checkbox"
              name="allow_decimal"
              checked={allowDecimal}
              onChange={(event) => {
                setAllowDecimal(event.target.checked);
                setDecimalTouched(true);
              }}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-body">Allow decimal quantities</span>
          </label>
        </Field>
        <Field label="Reorder point" hint="Flag it for restocking at or below this count.">
          <Input
            name="reorder_point"
            type="number"
            step="1"
            min="0"
            defaultValue={product?.reorderPoint ?? 5}
            required
          />
        </Field>

        <Field label="Bulk price" hint="Optional contractor price.">
          <Input
            name="bulk_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.bulkPrice ?? ""}
          />
        </Field>
        <Field label="Bulk starts at" hint="Quantity that unlocks the bulk price.">
          <Input
            name="bulk_min_quantity"
            type="number"
            step="1"
            min="2"
            defaultValue={product?.bulkMinQuantity ?? ""}
          />
        </Field>
      </div>

      {belowCost ? (
        <p className="flex items-start gap-2 rounded-sm border border-warning/50 bg-warning/12 px-3 py-2 text-body text-[#8a6516]">
          <TriangleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            This shelf price is below the supplier price. You lose{" "}
            {formatMoney(costValue - priceValue)} on every one sold. Save it if that is
            deliberate.
          </span>
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-caption text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Stock is not edited here. Use Inventory to restock or adjust, so every change
          is recorded as a movement.
        </span>
      </p>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? <SuccessNote>Saved. Terminals pick this up on their next sync.</SuccessNote> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="submit" loading={pending} icon={Check} className="w-full sm:w-auto">
          {pending ? "Saving..." : product ? "Save changes" : "Add product"}
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
