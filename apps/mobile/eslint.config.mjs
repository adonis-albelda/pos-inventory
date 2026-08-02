import reactNative from "@double-a/config-eslint/react-native";

export default [
  ...reactNative,
  {
    ignores: [".expo/**", "expo-env.d.ts"],
  },
];
