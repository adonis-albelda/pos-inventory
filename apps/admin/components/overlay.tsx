"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type OverlayContextValue = { onClose: () => void };

const OverlayContext = createContext<OverlayContextValue | null>(null);

function useOverlayClose() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("OverlayCloseButton must sit inside Dialog or Sheet");
  return ctx.onClose;
}

export function OverlayCloseButton({ label = "Close" }: { label?: string }) {
  const onClose = useOverlayClose();
  return (
    <button
      type="button"
      onClick={onClose}
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex size-9 cursor-pointer items-center justify-center rounded-sm text-ink-muted",
        "hover:bg-border/60 hover:text-ink",
        "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
      )}
    >
      <X size={18} strokeWidth={2} />
    </button>
  );
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const stableClose = useCallback(() => onClose(), [onClose]);

  useBodyScrollLock(open);
  useEscapeToClose(open, stableClose);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <OverlayContext.Provider value={{ onClose: stableClose }}>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-ink/40"
          onClick={stableClose}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            "relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col",
            "rounded-lg border border-border bg-surface shadow-lg outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-heading-sm font-semibold">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-caption text-ink-muted">{description}</p>
              ) : null}
            </div>
            <OverlayCloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </div>
    </OverlayContext.Provider>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Wider panel for product forms and dense field grids. */
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const stableClose = useCallback(() => onClose(), [onClose]);

  useBodyScrollLock(open);
  useEscapeToClose(open, stableClose);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <OverlayContext.Provider value={{ onClose: stableClose }}>
      <div className="fixed inset-0 z-50 flex justify-end">
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-ink/40"
          onClick={stableClose}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            "relative z-10 flex h-full w-full flex-col border-l border-border bg-surface shadow-lg outline-none",
            wide ? "max-w-2xl" : "max-w-md",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-heading-sm font-semibold">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-caption text-ink-muted">{description}</p>
              ) : null}
            </div>
            <OverlayCloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </div>
    </OverlayContext.Provider>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
