"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/overlay";
import { ErrorNote } from "@/components/ui";
import { removeSupplier } from "../actions";

export function DeleteSupplierButton({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    const form = new FormData();
    form.set("id", supplierId);
    startTransition(async () => {
      const result = await removeSupplier(form);
      setOpen(false);
      setError(result.error);
    });
  }

  return (
    <div className="space-y-2 sm:text-right">
      <button
        type="button"
        className="text-body text-danger hover:underline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete supplier
      </button>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        pending={pending}
        title="Delete supplier?"
        description={`${supplierName} will be removed. This cannot be undone.`}
        confirmLabel="Delete supplier"
      />
    </div>
  );
}
