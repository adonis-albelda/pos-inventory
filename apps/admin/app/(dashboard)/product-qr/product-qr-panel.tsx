"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer, QrCode } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
} from "@/components/ui";

export type QrProduct = { id: string; sku: string };

type PaperSize = "a4" | "legal";

const PAPER: Record<
  PaperSize,
  { label: string; widthMm: number; heightMm: number; css: string }
> = {
  a4: { label: "A4 (210 × 297 mm)", widthMm: 210, heightMm: 297, css: "A4" },
  legal: {
    label: "Legal (8.5 × 14 in)",
    widthMm: 216,
    heightMm: 356,
    css: "legal",
  },
};

const DEFAULT_COUNT = 20;
const MAX_COUNT = 48;

/** Columns that fit cleanly on band/label paper for the chosen count. */
function gridFor(count: number): { cols: number; rows: number } {
  if (count <= 8) return { cols: 2, rows: Math.ceil(count / 2) };
  if (count <= 12) return { cols: 3, rows: Math.ceil(count / 3) };
  if (count <= 20) return { cols: 4, rows: Math.ceil(count / 4) };
  if (count <= 30) return { cols: 5, rows: Math.ceil(count / 5) };
  return { cols: 6, rows: Math.ceil(count / 6) };
}

/**
 * Cell type and QR share shrink as more products crowd the page, and again
 * when the longest SKU on the sheet is long — full string stays readable,
 * never truncated.
 */
function cellScale(count: number, maxSkuLen: number): {
  skuPx: number;
  qrMax: string;
  qrWidth: number;
} {
  let skuPx: number;
  let qrMax: string;
  let qrWidth: number;

  if (count <= 4) {
    skuPx = 15;
    qrMax = "74%";
    qrWidth = 320;
  } else if (count <= 8) {
    skuPx = 13;
    qrMax = "70%";
    qrWidth = 288;
  } else if (count <= 12) {
    skuPx = 12;
    qrMax = "66%";
    qrWidth = 256;
  } else if (count <= 20) {
    skuPx = 11;
    qrMax = "62%";
    qrWidth = 224;
  } else if (count <= 30) {
    skuPx = 10;
    qrMax = "58%";
    qrWidth = 192;
  } else {
    skuPx = 9;
    qrMax = "54%";
    qrWidth = 160;
  }

  if (maxSkuLen > 28) skuPx = Math.max(7, skuPx - 3);
  else if (maxSkuLen > 20) skuPx = Math.max(7, skuPx - 2);
  else if (maxSkuLen > 14) skuPx = Math.max(8, skuPx - 1);

  return { skuPx, qrMax, qrWidth };
}

export function ProductQrPanel({ products }: { products: QrProduct[] }) {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [start, setStart] = useState(0);
  const [paper, setPaper] = useState<PaperSize>("a4");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const safeCount = Math.min(MAX_COUNT, Math.max(1, count || DEFAULT_COUNT));
  const maxStart = Math.max(0, products.length - 1);
  const safeStart = Math.min(Math.max(0, start), maxStart);

  const selected = useMemo(
    () => products.slice(safeStart, safeStart + safeCount),
    [products, safeStart, safeCount],
  );

  const { cols, rows } = gridFor(selected.length);
  const paperSpec = PAPER[paper];
  const maxSkuLen = useMemo(
    () => selected.reduce((max, product) => Math.max(max, product.sku.length), 0),
    [selected],
  );
  const scale = cellScale(selected.length || 1, maxSkuLen);

  useEffect(() => {
    let cancelled = false;

    async function build() {
      setBusy(true);
      const next: Record<string, string> = {};
      await Promise.all(
        selected.map(async (product) => {
          next[product.id] = await QRCode.toDataURL(product.sku, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: scale.qrWidth,
            color: { dark: "#1a1a1a", light: "#ffffff" },
          });
        }),
      );
      if (!cancelled) {
        setCodes(next);
        setBusy(false);
      }
    }

    void build();
    return () => {
      cancelled = true;
    };
  }, [selected, scale.qrWidth]);

  function printSheet() {
    window.print();
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden !important; }
              #product-qr-print, #product-qr-print * { visibility: visible !important; }
              #product-qr-print {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 8mm !important;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
                aspect-ratio: auto !important;
              }
              @page { size: ${paperSpec.css}; margin: 8mm; }
            }
          `,
        }}
      />

      <Card>
        <CardHeader
          icon={QrCode}
          title="Sheet options"
          description="How many products on this page, and which paper the printer uses."
        />
        <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
          <Field label="Products on page" hint={`Default ${DEFAULT_COUNT}. Max ${MAX_COUNT}.`}>
            <Input
              type="number"
              min={1}
              max={MAX_COUNT}
              value={count}
              onChange={(event) => setCount(Number(event.target.value) || 1)}
              className="num"
            />
          </Field>
          <Field
            label="Start at"
            hint={`1 = first product with a SKU. ${products.length} available.`}
          >
            <Input
              type="number"
              min={1}
              max={products.length}
              value={safeStart + 1}
              onChange={(event) =>
                setStart(Math.max(0, (Number(event.target.value) || 1) - 1))
              }
              className="num"
            />
          </Field>
          <Field label="Paper size">
            <Select
              value={paper}
              onChange={(event) => setPaper(event.target.value as PaperSize)}
            >
              <option value="a4">{PAPER.a4.label}</option>
              <option value="legal">{PAPER.legal.label}</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              icon={Printer}
              onClick={printSheet}
              disabled={selected.length === 0 || busy}
              className="w-full"
            >
              Print sheet
            </Button>
          </div>
        </div>
        <p className="border-t border-border px-4 py-3 text-caption text-ink-muted sm:px-6">
          Showing {selected.length} of {products.length} products with SKUs
          {busy ? " · generating QR…" : ""}. Grid {cols}×{rows}. Label shows SKU
          only — type scales with how many fit on the page.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          icon={Printer}
          title="Band paper preview"
          description={`${paperSpec.label} — what comes out of the printer.`}
        />
        <div className="flex justify-center bg-paper/80 px-4 py-6 sm:px-6">
          {selected.length === 0 ? (
            <EmptyState
              icon={QrCode}
              title="Nothing to print"
              instruction="Raise the start index or add SKUs to more products."
            />
          ) : (
            <div
              className="origin-top shadow-md"
              style={{
                // Scale the physical page into the viewport while keeping mm proportions.
                width: "min(100%, 420px)",
              }}
            >
              <div
                id="product-qr-print"
                className="box-border bg-white text-ink"
                style={{
                  aspectRatio: `${paperSpec.widthMm} / ${paperSpec.heightMm}`,
                  width: "100%",
                  padding: "3%",
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  gap: "1.5%",
                  border: "1px dashed #c4c0b5",
                }}
              >
                {selected.map((product) => (
                  <div
                    key={product.id}
                    className="flex min-h-0 flex-col items-center justify-center gap-1 overflow-hidden border border-border/70 px-1 py-1 text-center"
                  >
                    {codes[product.id] ? (
                      <img
                        src={codes[product.id]}
                        alt={`QR for ${product.sku}`}
                        className="h-auto w-[78%] object-contain"
                        style={{ maxHeight: scale.qrMax }}
                      />
                    ) : (
                      <div
                        className="flex aspect-square w-[78%] items-center justify-center bg-paper text-[10px] text-ink-muted"
                        style={{ maxHeight: scale.qrMax }}
                      >
                        …
                      </div>
                    )}
                    <span
                      className="num w-full px-0.5 font-semibold leading-tight"
                      style={{
                        fontSize: `${scale.skuPx}px`,
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {product.sku}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-caption text-ink-muted">
                {paperSpec.widthMm} × {paperSpec.heightMm} mm preview
              </p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
