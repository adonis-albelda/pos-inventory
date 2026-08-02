/**
 * The single definition of the design tokens from design-system.md.
 *
 * Plain values, no platform imports, so Tailwind (admin) and StyleSheet
 * (mobile) can both consume them and stay in step.
 */

export const color = {
  primary: "#0F5C52",
  primaryDark: "#0A3E38",
  /** Tinted fills carrying the brand into surfaces: badges, chips, icon wells. */
  primarySoft: "#E7EFED",
  /** The faintest teal wash, for a whole row or panel that should read as active. */
  primaryTint: "#F1F6F4",
  onPrimary: "#FFFFFF",
  accent: "#E8A33D",
  accentSoft: "#FBF1DC",
  /** Amber is too light to read as text; this is its legible counterpart. */
  accentInk: "#8A6516",
  success: "#3FA34D",
  successSoft: "#E7F3E9",
  successInk: "#256B31",
  danger: "#C1443C",
  dangerSoft: "#F7E3E1",
  dangerInk: "#9C332C",
  warning: "#D9A441",
  warningSoft: "#FBF1DC",
  warningInk: "#8A6516",
  ink: "#1B1F1D",
  inkMuted: "#5B655F",
  /** Near-white field — not pure white, not cream. */
  paper: "#F5F5F3",
  surface: "#FFFFFF",
  /** Pressed state for a paper/surface tap target — dim, never animate. */
  surfacePressed: "#F1EFEA",
  border: "#E4E0D8",
  /** For a divider that must be present but not read as a boundary in the data. */
  borderSoft: "#EFEBE4",
} as const;

/** 4, 8, 12, 16, 24, 32, 48, 64 — no arbitrary one-off values. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
} as const;

export const fontSize = {
  caption: 12,
  body: 14,
  bodyLg: 16,
  headingSm: 20,
  headingMd: 24,
  headingLg: 32,
  display: 40,
} as const;

export const fontFamily = {
  display: "Manrope",
  body: "Inter",
  /** Prices, quantities, totals — anything that has to align in a column. */
  numeric: "IBM Plex Mono",
} as const;

/**
 * The ledger line: a dashed divider used only at real boundaries in the data —
 * cart items from their total, synced sales from pending ones.
 */
export const ledgerLine = {
  borderStyle: "dashed" as const,
  borderWidth: 1,
  borderColor: color.border,
};

/** Minimum tap target on the shop floor. Bigger for primary actions. */
export const MIN_TAP_TARGET = 48;

export type ColorToken = keyof typeof color;
export type StatusTone = "success" | "warning" | "danger" | "neutral";

export const statusColor: Record<StatusTone, string> = {
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  neutral: color.inkMuted,
};
