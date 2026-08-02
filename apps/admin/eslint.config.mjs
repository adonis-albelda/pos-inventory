import next from "@double-a/config-eslint/next";

export default [
  ...next,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
