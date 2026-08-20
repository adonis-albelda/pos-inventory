import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color } from "@/theme";

/**
 * Bottom of the page — brand green, wavy top edge instead of a hard cut.
 * Drawn with react-native-svg (already linked, see sage-backdrop.tsx) rather
 * than an image, so it always exactly fits the device width/height.
 *
 * Shared by setup, unlock and the Sync tab — content floats as cards over
 * this same wave in all three.
 */
export function WaveBackdrop() {
  const { width, height } = useWindowDimensions();
  const waveTop = height / 2;
  const amplitude = 36;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Svg width={width} height={height}>
        <Path
          d={`M0,${waveTop - amplitude} L0,${height} L${width},${height} L${width},${waveTop - amplitude} Q${width / 2},${waveTop + amplitude} 0,${waveTop - amplitude} Z`}
          fill={color.primary}
        />
      </Svg>
    </View>
  );
}
