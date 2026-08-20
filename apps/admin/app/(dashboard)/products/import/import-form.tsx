"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  Ban,
  Check,
  FolderPlus,
  Info,
  Search,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  FileInput,
  SuccessNote,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { EMPTY_IMPORT_STATE } from "./import-state";
import { importProducts } from "./actions";

/** Both forms share one action, so each button reads its own form's state. */
function SubmitButton({
  icon,
  label,
  busyLabel,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  busyLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" icon={icon} loading={pending} disabled={disabled}>
      {pending ? busyLabel : label}
    </Button>
  );
}

export function ImportForm() {
  const [state, submit] = useActionState(importProducts, EMPTY_IMPORT_STATE);
  const plan = state.plan;

  return (
    <div className="space-y-6">
      <form action={submit} className="space-y-4">
        <input type="hidden" name="intent" value="check" />

        <Field label="CSV file" hint="Required columns: name, sku, price.">
          <FileInput name="file" accept=".csv,text/csv" />
        </Field>

        <Field label="Or paste the rows" hint="Header row first, commas between columns.">
          <Textarea
            name="pasted"
            rows={4}
            placeholder="name,sku,price&#10;PVC pipe 1/2 inch x 3m,PVC-050-3M,185.00"
          />
        </Field>

        <p className="flex items-start gap-2 text-caption text-ink-muted">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Stock is never imported. A stock_quantity column is ignored — counts only
            move through Inventory, so every change stays recorded as a movement. A
            blank cell keeps whatever the product already has.
          </span>
        </p>

        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <SubmitButton icon={Search} label="Check the file" busyLabel="Reading..." />
      </form>

      {state.ok ? (
        <div className="space-y-3">
          <SuccessNote>
            Imported {state.imported} products
            {state.skipped ? `, turned away ${state.skipped}` : ""}. Terminals pick them
            up on their next sync.
          </SuccessNote>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-body font-medium text-primary hover:underline"
          >
            Back to products
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}

      {state.failures && state.failures.length > 0 ? (
        <div className="space-y-2 rounded-sm border border-danger/50 bg-danger/8 px-3 py-2">
          <p className="flex items-start gap-2 text-body font-medium text-danger">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Rows that were accepted but failed to save:
          </p>
          <ul className="space-y-1 text-caption text-ink-muted">
            {state.failures.map((failure) => (
              <li key={failure.line}>
                Line {failure.line} ({failure.sku || "—"}): {failure.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan ? (
        <div className="space-y-4">
          {/* A real boundary: above is the file, below is what it would do. */}
          <div className="ledger-line" />

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" icon={FolderPlus}>
              {plan.createCount} new
            </Badge>
            <Badge tone="neutral" icon={Upload}>
              {plan.updateCount} updated
            </Badge>
            <Badge tone={plan.rejectCount > 0 ? "danger" : "neutral"} icon={Ban}>
              {plan.rejectCount} turned away
            </Badge>
          </div>

          {plan.newCategoryPaths.length > 0 ? (
            <p className="flex items-start gap-2 rounded-sm border border-border bg-paper px-3 py-2 text-body text-ink-muted">
              <FolderPlus size={16} className="mt-0.5 shrink-0" />
              <span>
                These categories do not exist yet and will be created:{" "}
                <span className="font-medium text-ink">
                  {plan.newCategoryPaths.join(", ")}
                </span>
              </span>
            </p>
          ) : null}

          {plan.unknownColumns.length > 0 ? (
            <p className="flex items-start gap-2 rounded-sm border border-warning/50 bg-warning/12 px-3 py-2 text-body text-[#8a6516]">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                Ignored columns: {plan.unknownColumns.join(", ")}. Check the spelling if
                one of those was meant to land somewhere.
              </span>
            </p>
          ) : null}

          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <thead>
                <tr>
                  <Th numeric>Line</Th>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th>What happens</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.line}>
                    <Td numeric className="text-ink-muted">
                      {row.line}
                    </Td>
                    <Td className="font-medium">{row.name || "—"}</Td>
                    <Td className="num text-ink-muted">{row.sku || "—"}</Td>
                    <Td>
                      {row.action === "create" ? (
                        <Badge tone="success" icon={FolderPlus}>
                          New product
                        </Badge>
                      ) : row.action === "update" ? (
                        <Badge tone="neutral" icon={Upload}>
                          Update
                        </Badge>
                      ) : (
                        <Badge tone="danger" icon={Ban}>
                          Turned away
                        </Badge>
                      )}
                    </Td>
                    <Td
                      className={
                        row.action === "reject" ? "text-danger" : "text-ink-muted"
                      }
                    >
                      {row.notes.join(" ")}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <form action={submit} className="flex items-center gap-3">
            <input type="hidden" name="intent" value="import" />
            <input type="hidden" name="csv" value={state.csv} />
            <SubmitButton
              icon={Check}
              label={`Import ${plan.createCount + plan.updateCount} products`}
              busyLabel="Importing..."
              disabled={plan.createCount + plan.updateCount === 0}
            />
            <span className="text-caption text-ink-muted">
              Nothing has been written yet.
            </span>
          </form>
        </div>
      ) : null}
    </div>
  );
}
