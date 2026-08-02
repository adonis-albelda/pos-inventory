"use client";

import { useState } from "react";
import { Ban, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { voidSaleAction } from "./actions";

/** Destructive and irreversible, so it asks first — deliberately. */
export function VoidSale({ saleId }: { saleId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="danger"
        icon={Ban}
        className="w-full sm:w-auto"
        onClick={() => setConfirming(true)}
      >
        Void sale
      </Button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-md border border-danger/40 bg-danger/8 p-4 sm:w-auto">
      <p className="flex items-start gap-2 text-body text-danger">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <span>Void this sale? The stock goes back and this cannot be undone.</span>
      </p>
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
        <form action={voidSaleAction} className="sm:contents">
          <input type="hidden" name="id" value={saleId} />
          <Button variant="danger" size="sm" icon={Ban} type="submit" className="w-full sm:w-auto">
            Yes, void it
          </Button>
        </form>
        <Button
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setConfirming(false)}
        >
          Keep sale
        </Button>
      </div>
    </div>
  );
}
