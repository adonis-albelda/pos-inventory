import { useEffect, useState, type ReactNode } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, radius, space } from "@/theme";

/** Live keyboard height — Modals on Android ignore activity adjustResize. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/**
 * Bottom drawer that rises with the keyboard so inputs stay visible on a real
 * device. Scrim tap dismisses; sheet content stays above the keys.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  contentStyle,
  scroll = true,
  maxWidth = 560,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Wrap children in a ScrollView so tall forms stay reachable. */
  scroll?: boolean;
  maxWidth?: number;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  if (!open) return null;

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[{ gap: space.md }, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ gap: space.md }, contentStyle]}>{children}</View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: `${color.ink}99` }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={StyleSheet.absoluteFill}
        />

        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: "flex-end",
            // Push the docked sheet above the soft keyboard.
            paddingBottom: keyboardHeight,
          }}
        >
          <View
            style={{
              backgroundColor: color.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: space.lg,
              paddingBottom: Math.max(insets.bottom, space.lg),
              width: "100%",
              maxWidth,
              alignSelf: "center",
              // Leave room for the field + actions when the keyboard is up.
              maxHeight: keyboardHeight > 0 ? "88%" : "92%",
            }}
          >
            {body}
          </View>
        </View>
      </View>
    </Modal>
  );
}
