import reactHooks from "eslint-plugin-react-hooks";
import { base } from "./base.js";

/** Next.js flavour: the admin app is always online, so no offline/sync rules apply here. */
export const next = [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Just the two classic rules the codebase's own eslint-disable comments
      // expect — v7's full "recommended" config also turns on a batch of new
      // React-Compiler-era rules (purity, immutability, set-state-in-render,
      // etc) that haven't been evaluated against this codebase yet.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "expo-sqlite",
              message:
                "apps/admin has no local database. It reads and writes the Tally API directly.",
            },
          ],
        },
      ],
    },
  },
];

export default next;
