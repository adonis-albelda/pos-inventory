"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  COMPANY_INTRO_HOLD_MS,
  COMPANY_LEAD,
  COMPANY_POWERED_BY,
  COMPANY_PRODUCT,
} from "@double-a/ui";

const SESSION_KEY = "da-company-intro-seen";

/**
 * Full-screen company intro for admin. Once per browser session: logo, product,
 * one powered-by line — then fades so the real page sits underneath.
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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "linear-gradient(165deg, #e9f1ec 0%, #c6dacf 48%, #9dbcac 100%)",
      }}
    >
      <div className="flex max-w-sm flex-col items-center [animation:intro-pop_600ms_ease-out]">
        <Image
          src="/logo.png"
          alt=""
          width={96}
          height={96}
          priority
          className="size-24 object-contain"
        />

        <p className="mt-8 font-display text-heading-sm font-extrabold tracking-[0.18em] text-ink">
          {COMPANY_LEAD}
        </p>

        <span
          aria-hidden
          className="mt-4 block h-0.5 w-10 rounded-full bg-primary"
        />

        <p className="mt-4 text-caption font-medium tracking-[0.08em] text-ink-muted uppercase">
          {COMPANY_PRODUCT}
        </p>

        <p className="mt-14 text-center font-sans text-body-lg font-medium leading-relaxed text-ink [animation:intro-tag-in_500ms_ease-out_180ms_both]">
          {COMPANY_POWERED_BY}
        </p>
      </div>

      <p className="absolute bottom-10 text-caption font-medium tracking-wide text-primary-dark/70">
        Click to continue
      </p>
    </button>
  );
}
