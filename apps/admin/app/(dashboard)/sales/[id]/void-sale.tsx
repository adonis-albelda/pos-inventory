"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/overlay";
import { voidSaleAction } from "./actions";

/** Destructive and irreversible, so it asks first — deliberately. */
export function VoidSale({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    const form = new FormData();
    form.set("id", saleId);
    startTransition(async () => {
      await voidSaleAction(form);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="danger"
        icon={Ban}
        className="w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        Void sale
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        pending={pending}
        title="Void this sale?"
        description="The stock goes back and this cannot be undone."
        confirmLabel="Void sale"
      />
    </>
  );
}
