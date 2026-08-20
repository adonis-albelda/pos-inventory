"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, Search, Truck } from "lucide-react";
import {
  SUPPLIER_ADDRESS_MAX,
  SUPPLIER_CONTACT_PERSON_MAX,
  SUPPLIER_EMAIL_MAX,
  SUPPLIER_NAME_MAX,
  SUPPLIER_PHONE_MAX,
} from "@double-a/shared-types";
import type { Product, Supplier } from "@double-a/shared-types";
import { Button, ErrorNote, Field, Input, SuccessNote } from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { useInvalidateSuppliers } from "@/lib/query/suppliers";
import { saveSupplier } from "./actions";

export function SupplierForm({
  supplier,
  products,
  linkedProductIds,
  onDone,
}: {
  supplier?: Supplier;
  products: Product[];
  /** Already-checked products, when editing. Empty (not undefined) when creating. */
  linkedProductIds?: string[];
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveSupplier, EMPTY_FORM_STATE);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(linkedProductIds ?? []),
  );
  const invalidate = useInvalidateSuppliers();

  useEffect(() => {
    if (state.ok) {
      invalidate();
      onDone?.();
    }
    // invalidate is stable enough for this effect; only state.ok/onDone gate re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, onDone]);

  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const pool = needle
      ? products.filter(
          (product) =>
            product.name.toLowerCase().includes(needle) ||
            (product.sku ?? "").toLowerCase().includes(needle),
        )
      : products;
    return pool.slice(0, 40);
  }, [products, search]);

  function toggle(productId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-4">
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      <input type="hidden" name="product_ids" value={Array.from(selected).join(",")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            name="name"
            defaultValue={supplier?.name}
            required
            maxLength={SUPPLIER_NAME_MAX}
          />
        </Field>
        <Field label="Contact person">
          <Input
            name="contact_person"
            defaultValue={supplier?.contactPerson ?? ""}
            maxLength={SUPPLIER_CONTACT_PERSON_MAX}
          />
        </Field>
        <Field label="Phone">
          <Input
            name="phone"
            defaultValue={supplier?.phone ?? ""}
            maxLength={SUPPLIER_PHONE_MAX}
          />
        </Field>
        <Field label="Email">
          <Input
            name="email"
            type="email"
            defaultValue={supplier?.email ?? ""}
            maxLength={SUPPLIER_EMAIL_MAX}
          />
        </Field>
      </div>

      <Field label="Address">
        <Input
          name="address"
          defaultValue={supplier?.address ?? ""}
          maxLength={SUPPLIER_ADDRESS_MAX}
        />
      </Field>

      {supplier ? (
        <Field
          label="Active"
          hint="Off hides it from new purchase orders. Existing orders are unaffected."
        >
          <label className="flex min-h-11 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-body">
            <input
              type="checkbox"
              name="is_active"
              value="true"
              defaultChecked={supplier.isActive}
              className="size-4 accent-primary"
            />
            Supplier is active
          </label>
        </Field>
      ) : null}

      <div>
        <span className="mb-1 block text-caption font-medium text-ink-muted">
          Products this supplier carries
        </span>
        <div className="rounded-sm border border-border">
          <div className="border-b border-border p-2">
            <Input
              icon={Search}
              placeholder="Filter products…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-2">
            {visibleProducts.length === 0 ? (
              <p className="px-2 py-3 text-caption text-ink-muted">No products match.</p>
            ) : (
              visibleProducts.map((product) => (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body hover:bg-paper"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={selected.has(product.id)}
                    onChange={() => toggle(product.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  {product.sku ? (
                    <span className="shrink-0 text-caption text-ink-muted">{product.sku}</span>
                  ) : null}
                </label>
              ))
            )}
          </div>
        </div>
        <p className="mt-1 text-caption text-ink-muted">{selected.size} selected</p>
      </div>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? <SuccessNote>Saved.</SuccessNote> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          type="submit"
          loading={pending}
          icon={supplier ? Check : Truck}
          className="w-full sm:w-auto"
        >
          {pending ? "Saving..." : supplier ? "Save changes" : "Add supplier"}
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
