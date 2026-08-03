"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { PurchaseOrderStatus, Supplier } from "@double-a/shared-types";
import { PURCHASE_ORDER_STATUS_LABELS } from "@double-a/shared-types";
import { Button, Field, Select } from "@/components/ui";

const STATUSES = Object.keys(PURCHASE_ORDER_STATUS_LABELS) as PurchaseOrderStatus[];

export function PurchaseOrdersFilters({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(formData: FormData) {
    const next = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    const q = params.get("q");
    if (q) next.set("q", q);
    router.push(`/purchase-orders?${next.toString()}` as Route);
  }

  return (
    <form action={apply} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier">
          <Select name="supplierId" defaultValue={params.get("supplierId") ?? ""}>
            <option value="">Every supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">Any</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {PURCHASE_ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="submit" icon={Search} className="w-full sm:w-auto">
          Apply
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon={X}
          className="w-full sm:w-auto"
          onClick={() => router.push("/purchase-orders" as Route)}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
