import { base } from "./base.js";

export const reactNative = [
  ...base,
  {
    // metro.config.js and babel.config.js run in Node, as CommonJS.
    files: ["*.config.js"],
    languageOptions: {
      globals: {
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        __DEV__: "readonly",
        fetch: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
  },
];

export default reactNative;
