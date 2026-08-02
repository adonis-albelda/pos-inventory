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
  // The dashboard gets opened from other machines on the shop LAN during
  // development. Without this, Next blocks /_next dev resources from those
  // origins and the page renders but never hydrates.
  allowedDevOrigins: ["192.168.68.101", "*.local"],
};

export default nextConfig;
