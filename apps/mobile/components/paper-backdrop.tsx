import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { color } from "@/theme";

/**
 * Quiet ledger texture — faint dots + light dashed rules. Matches the design
 * system's ledger motif; stays out of the way of product tiles (shop-floor
 * contrast). Bubbles/squares read as wallpaper; this reads as paper.
 */
export function PaperBackdrop() {
  const { width, height } = useWindowDimensions();
  const step = 28;
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;

  const marks: ReactNode[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = row * step + 0.5;
    if (row > 0 && row % 4 === 0) {
      marks.push(
        <Line
          key={`rule-${row}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke={color.border}
          strokeWidth={1}
          strokeDasharray="2 10"
          opacity={0.55}
        />,
      );
    }
    for (let col = 0; col < cols; col += 1) {
      marks.push(
        <Circle
          key={`dot-${row}-${col}`}
          cx={col * step + 0.5}
          cy={y}
          r={1}
          fill={color.ink}
          opacity={0.06}
        />,
      );
    }
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Svg width={width} height={height}>
        {marks}
      </Svg>
    </View>
  );
}
