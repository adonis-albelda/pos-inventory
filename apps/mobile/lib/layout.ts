import { useWindowDimensions } from "react-native";
import { space } from "@/theme";

/**
 * The one breakpoint from design-system.md. Below it no screen may assume a
 * side-by-side layout.
 */
export const COMPACT_BREAKPOINT = 720;

/**
 * Every screen reads its sizing from here rather than comparing widths inline,
 * so a phone, a 7" tablet in portrait and a 13" tablet in landscape all stay in
 * step. Values come from the spacing scale — no arbitrary one-offs.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();

  const compact = width < COMPACT_BREAKPOINT;
  /** A large tablet, where the extra width buys air rather than more columns. */
  const expanded = width >= 1024;
  const landscape = width > height;

  return {
    width,
    height,
    compact,
    expanded,
    landscape,

    /** 2 under 480dp, 3 under 900dp, 4 above. */
    columns: width < 480 ? 2 : width < 900 ? 3 : 4,

    /** Screen padding. Tight — shop floor wants product tiles, not margin. */
    gutter: compact ? space.sm : expanded ? space.lg : space.md,
    gap: compact ? space.xs : space.sm,

    /**
     * On a wide tablet an unbounded grid grows tiles to billboard size, so the
     * grid is capped and centred instead. The cart takes a fixed share rather
     * than a flex ratio, so it stays a readable column at any width.
     */
    gridMaxWidth: 1120,
    cartWidth: Math.round(Math.min(Math.max(width * 0.34, 300), 420)),

    /**
     * Forms and receipts read badly full-bleed on a tablet — but a large
     * tablet held sideways has real width to spare, so the cap widens there
     * rather than leaving the same 760 marooned in the middle of the screen.
     * Only this number moves; the wave backdrop, headers and page padding
     * stay exactly as wide as the screen either way.
     */
    readableMaxWidth: landscape && expanded ? 960 : 760,

    tileMinHeight: compact ? 96 : expanded ? 128 : 112,
  };
}

export type Layout = ReturnType<typeof useLayout>;
