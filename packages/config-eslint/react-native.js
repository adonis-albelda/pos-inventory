import reactHooks from "eslint-plugin-react-hooks";
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
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Same minimal pair as config-eslint/next.js — not v7's full
      // "recommended" set, which adds several new React-Compiler-era rules
      // unevaluated against this codebase.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default reactNative;
