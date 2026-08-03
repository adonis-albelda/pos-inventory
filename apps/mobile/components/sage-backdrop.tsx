import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { color } from "@/theme";

/**
 * Sage gradient behind splash and login. Drawn with react-native-svg, which is
 * already linked — a gradient is not worth another native module on a runtime
 * that has to match the dev client exactly (see the pinned-versions note in
 * README).
 *
 * Light at the top, deeper toward the bottom, so a white card sitting mid-screen
 * separates from the wash without a shadow. The dot field is the ledger motif
 * from `PaperBackdrop`, kept faint so it reads as texture, not pattern.
 */
export function SageBackdrop() {
  const { width, height } = useWindowDimensions();

  const step = 32;
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  const dots = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      dots.push(
        <Circle
          key={`dot-${row}-${col}`}
          cx={col * step + 0.5}
          cy={row * step + 0.5}
          r={1}
          fill={color.surface}
          opacity={0.35}
        />,
      );
    }
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sage" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={color.sageLight} />
            <Stop offset="0.52" stopColor={color.sage} />
            <Stop offset="1" stopColor={color.sageDeep} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sage)" />
        {dots}
      </Svg>
    </View>
  );
}
