import { StyleSheet } from "react-native";
import { MIN_TAP_TARGET, color, fontSize, radius, space } from "@double-a/ui";

export { MIN_TAP_TARGET, color, fontSize, radius, space };

/**
 * Shop-floor rules from design-system.md: big tap targets, high contrast, flat
 * surfaces (shadows cost battery), and totals rendered large enough to read at
 * a glance under bad lighting.
 */
export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.paper,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  /** A card that should read as brand surface rather than plain paper. */
  cardTinted: {
    backgroundColor: color.primaryTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.primarySoft,
  },
  /** Square well behind an icon, sized by the caller. */
  iconWell: {
    borderRadius: radius.sm,
    backgroundColor: color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: fontSize.headingMd,
    fontWeight: "600",
    color: color.ink,
  },
  subheading: {
    fontSize: fontSize.headingSm,
    fontWeight: "600",
    color: color.ink,
  },
  body: {
    fontSize: fontSize.bodyLg,
    color: color.ink,
  },
  muted: {
    fontSize: fontSize.body,
    color: color.inkMuted,
  },
  /** Tabular figures so columns of pesos line up like a printed receipt. */
  numeric: {
    fontVariant: ["tabular-nums"],
    color: color.ink,
  },
  /** A price the cashier is reading off a tile, carried in brand teal. */
  price: {
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    color: color.primary,
  },
  total: {
    fontVariant: ["tabular-nums"],
    fontSize: fontSize.headingMd,
    fontWeight: "700",
    color: color.ink,
  },
  /**
   * The ledger line. Used only at real boundaries: cart items from the total,
   * pending sales from synced ones.
   */
  ledgerLine: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: color.border,
  },
  tapTarget: {
    minHeight: MIN_TAP_TARGET,
    minWidth: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
});
