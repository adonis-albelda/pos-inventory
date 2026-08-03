/** Marketing copy for DOUBLE A Digital Solutions intros (admin + POS). */
export const COMPANY_NAME = "DOUBLE A DIGITAL SOLUTIONS";

/**
 * The name split for the intro lockup: the mark lands at once, the trade is
 * typed out after it. Kept here so admin and POS type the same words.
 */
export const COMPANY_LEAD = "DOUBLE A";
export const COMPANY_TRADE = "DIGITAL SOLUTIONS";

/** Per-character delay while COMPANY_TRADE types itself in (ms). */
export const COMPANY_TYPE_MS = 90;

export const COMPANY_TAGLINES = [
  "Great ideas deserve great software — no tech background required.",
  "You bring the idea. We bring the code.",
  "Great ideas deserve great software.",
] as const;

/** How long each tagline stays on screen before the next (ms). */
export const COMPANY_TAGLINE_MS = 2800;
