import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Shared flat config for every package and app in the monorepo. */
export const base = tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.expo/**",
      "**/dist/**",
      "**/android/**",
      "**/ios/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);

export default base;
