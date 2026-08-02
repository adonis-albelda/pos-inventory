"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  COMPANY_NAME,
  COMPANY_TAGLINE_MS,
  COMPANY_TAGLINES,
} from "@double-a/ui";

const SESSION_KEY = "da-company-intro-seen";

/**
 * Full-screen company intro for admin. Once per browser session, then fades
 * out so the real page remains underneath.
 */
export function CompanyIntro() {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
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

    const nextAt = window.setTimeout(() => {
      if (index >= COMPANY_TAGLINES.length - 1) {
        dismiss();
        return;
      }
      setIndex((current) => current + 1);
    }, COMPANY_TAGLINE_MS);

    return () => window.clearTimeout(nextAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index, leaving]);

  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
    window.setTimeout(() => setVisible(false), 420);
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Continue"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-primary-dark px-8 transition-opacity duration-400 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6 [animation:intro-pop_500ms_ease-out]">
        <div className="flex size-24 items-center justify-center bg-surface p-2">
          <Image
            src="/logo.png"
            alt=""
            width={72}
            height={72}
            priority
            className="size-[72px] object-contain"
          />
        </div>
        <p className="text-center font-display text-heading-sm font-extrabold tracking-[0.12em] text-on-primary">
          {COMPANY_NAME}
        </p>
      </div>

      <div className="mt-12 flex min-h-[4.5rem] w-full max-w-md items-center justify-center">
        <p
          key={index}
          className="text-center font-sans text-body-lg font-medium leading-relaxed text-white/90 [animation:intro-tag-in_350ms_ease-out]"
        >
          {COMPANY_TAGLINES[index]}
        </p>
      </div>

      <p className="absolute bottom-12 text-caption font-semibold tracking-wide text-white/45">
        Click to continue
      </p>
    </button>
  );
}
