"use client";

import { useActionState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { Product } from "@double-a/shared-types";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  SuccessNote,
} from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { moveStock } from "./actions";

export function StockForm({
  products,
  defaultProductId,
}: {
  products: Product[];
  defaultProductId?: string;
}) {
  const [state, action, pending] = useActionState(moveStock, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Product">
          <Select name="product_id" defaultValue={defaultProductId ?? ""} required>
            <option value="">Pick a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.sku ? ` (${product.sku})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Direction">
          <Select name="direction" defaultValue="in">
            <option value="in">Add stock</option>
            <option value="out">Remove stock</option>
          </Select>
        </Field>

        <Field label="Quantity">
          <Input name="quantity" type="number" min="1" step="1" required />
        </Field>

        <Field label="Reason">
          <Select name="reason" defaultValue="restock">
            <option value="restock">Restock</option>
            <option value="adjustment">Adjustment</option>
            <option value="oversell_correction">Oversell correction</option>
          </Select>
        </Field>
      </div>

      <Field label="Note" hint="Optional. Shows in the movement history.">
        <Input name="note" placeholder="Delivery from supplier, recount after audit..." />
      </Field>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.ok ? <SuccessNote>Movement recorded. Stock updated.</SuccessNote> : null}

      <Button type="submit" loading={pending} icon={ClipboardCheck} className="w-full sm:w-auto">
        {pending ? "Recording..." : "Record movement"}
      </Button>
    </form>
  );
}
