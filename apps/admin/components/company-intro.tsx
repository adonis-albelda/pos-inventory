"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { COMPANY_INTRO_HOLD_MS, COMPANY_LEAD, COMPANY_PRODUCT } from "@double-a/ui";

const SESSION_KEY = "da-company-intro-seen";

/**
 * Full-screen company intro for admin. Once per browser session: logo,
 * product tagline, a "Preparing…" beat — then fades so the real page sits
 * underneath. bg-paper, same as the rest of the app; no separate branded
 * background, no "powered by" line, nothing to read past the loader.
 */
export function CompanyIntro() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      // Private mode — still show once this mount.
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible || leaving) return;

    const timer = window.setTimeout(() => dismiss(), COMPANY_INTRO_HOLD_MS);
    return () => window.clearTimeout(timer);
    // dismiss is stable enough for this mount; leaving gates re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, leaving]);

  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
    window.setTimeout(() => setVisible(false), 480);
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Continue"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-paper px-8 transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center [animation:intro-pop_600ms_ease-out]">
        <div className="flex size-14 items-center justify-center rounded-xl bg-primary-soft">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="size-8 object-contain"
          />
        </div>

        <p className="mt-4 font-display text-heading-sm font-bold text-ink">
          {COMPANY_LEAD}
        </p>

        <p className="mt-1 text-center text-body text-ink-muted [animation:intro-tag-in_500ms_ease-out_180ms_both]">
          {COMPANY_PRODUCT}
        </p>
      </div>

      <div className="flex items-center gap-2 text-caption text-ink-muted">
        <Loader2 size={14} strokeWidth={2} className="animate-spin" />
        Preparing…
      </div>
    </button>
  );
}
