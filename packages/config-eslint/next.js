import { base } from "./base.js";

/** Next.js flavour: the admin app is always online, so no offline/sync rules apply here. */
export const next = [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "expo-sqlite",
              message:
                "apps/admin has no local database. It reads and writes Supabase directly.",
            },
          ],
        },
      ],
    },
  },
];

export default next;
