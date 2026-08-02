import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, not built output.
  transpilePackages: ["@double-a/shared-types", "@double-a/supabase", "@double-a/ui"],
  typedRoutes: true,
  experimental: {
    // A product import posts the whole CSV to a server action, twice: once to
    // preview it and once to confirm. A supplier price list runs well past the
    // 1MB default.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Dev-only: allow HMR /_next from any LAN/IP/hostname (Next rejects bare "*").
  // Tighten before sharing this machine on an untrusted network.
  allowedDevOrigins: ["**.*"],
};

export default nextConfig;
