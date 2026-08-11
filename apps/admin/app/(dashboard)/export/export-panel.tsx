"use client";

import { useMemo, useState } from "react";
import {
  CheckSquare,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Square,
} from "lucide-react";
import {
  BACKUP_DATASETS,
  BACKUP_DATASET_META,
  type BackupDatasetId,
} from "@/lib/backup-export";
import { Button, Card, CardHeader, ErrorNote } from "@/components/ui";

type Format = "csv" | "xlsx" | "pdf";

const FORMATS: {
  id: Format;
  label: string;
  hint: string;
  icon: typeof FileArchive;
}[] = [
  {
    id: "csv",
    label: "CSV (zip)",
    hint: "One CSV per table, zipped. Best for imports and scripts.",
    icon: FileArchive,
  },
  {
    id: "xlsx",
    label: "Excel",
    hint: "One workbook, one sheet per table. Full rows.",
    icon: FileSpreadsheet,
  },
  {
    id: "pdf",
    label: "PDF",
    hint: "Printable preview — first columns and rows only. Use Excel/CSV for a full dump.",
    icon: FileText,
  },
];

export function ExportPanel() {
  const [selected, setSelected] = useState<Record<BackupDatasetId, boolean>>(
    () => Object.fromEntries(BACKUP_DATASETS.map((id) => [id, true])) as Record<
      BackupDatasetId,
      boolean
    >,
  );
  const [format, setFormat] = useState<Format>("xlsx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = useMemo(
    () => BACKUP_DATASETS.filter((id) => selected[id]),
    [selected],
  );

  function toggle(id: BackupDatasetId) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAll() {
    setSelected(
      Object.fromEntries(BACKUP_DATASETS.map((id) => [id, true])) as Record<
        BackupDatasetId,
        boolean
      >,
    );
  }

  function clearAll() {
    setSelected(
      Object.fromEntries(BACKUP_DATASETS.map((id) => [id, false])) as Record<
        BackupDatasetId,
        boolean
      >,
    );
  }

  async function download() {
    setError(null);
    if (picked.length === 0) {
      setError("Pick at least one dataset.");
      return;
    }

    setBusy(true);
    try {
      const params = new URLSearchParams({
        format,
        datasets: picked.join(","),
      });
      const response = await fetch(`/api/export/backup?${params.toString()}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text.trim() || `Download failed (${response.status}).`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `double-a-backup.${format === "csv" ? "zip" : format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={CheckSquare}
          title="Datasets"
          description="What leaves the shop. PIN hashes and passwords never export."
        />
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
          <span className="ml-auto self-center text-caption text-ink-muted">
            {picked.length} of {BACKUP_DATASETS.length} selected
          </span>
        </div>
        <ul className="divide-y divide-border">
          {BACKUP_DATASETS.map((id) => {
            const meta = BACKUP_DATASET_META[id];
            const on = selected[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left sm:px-6"
                >
                  {on ? (
                    <CheckSquare size={18} className="mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <Square size={18} className="mt-0.5 shrink-0 text-ink-muted" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-body font-medium">{meta.label}</span>
                    <span className="block text-caption text-ink-muted">
                      {meta.blurb}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader
          icon={Download}
          title="Format"
          description="CSV and Excel carry full rows. PDF is a readable preview."
        />
        <div className="grid gap-2 px-4 py-5 sm:grid-cols-3 sm:px-6">
          {FORMATS.map((option) => {
            const Icon = option.icon;
            const active = format === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFormat(option.id)}
                aria-pressed={active}
                className={[
                  "cursor-pointer rounded-sm border px-3 py-3 text-left transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary-tint"
                    : "border-border bg-surface hover:border-ink/20",
                ].join(" ")}
              >
                <span className="flex items-center gap-2 text-body font-medium">
                  <Icon size={16} strokeWidth={2} />
                  {option.label}
                </span>
                <span className="mt-1 block text-caption text-ink-muted">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <Button
            type="button"
            icon={Download}
            loading={busy}
            disabled={picked.length === 0}
            onClick={() => void download()}
          >
            {busy ? "Building…" : `Download ${FORMATS.find((f) => f.id === format)?.label}`}
          </Button>
          <p className="text-caption text-ink-muted">
            Sales and movements use a recent-row cap so a huge history still finishes.
            Truncation is noted in the file.
          </p>
        </div>
        {error ? (
          <div className="px-4 pb-4 sm:px-6">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
