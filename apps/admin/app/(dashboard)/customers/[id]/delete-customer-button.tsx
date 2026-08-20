"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/overlay";
import { useInvalidateCustomers } from "@/lib/query/customers";
import { removeCustomer } from "../actions";

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const invalidate = useInvalidateCustomers();

  function confirm() {
    const form = new FormData();
    form.set("id", customerId);
    startTransition(async () => {
      await removeCustomer(form);
      invalidate();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        className="text-body text-danger hover:underline"
        onClick={() => setOpen(true)}
      >
        Delete customer
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        pending={pending}
        title="Delete customer?"
        description={`${customerName} will be removed. Sales keep the name already printed on them. This cannot be undone.`}
        confirmLabel="Delete customer"
      />
    </>
  );
}
