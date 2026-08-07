import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, not built output.
  transpilePackages: ["@double-a/shared-types", "@double-a/supabase", "@double-a/ui"],
  typedRoutes: true,
  experimental: {
    // CSV import and notebook photo OCR both post larger payloads than the
    // 1MB default (supplier lists, phone camera JPEGs).
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Dev-only: allow HMR /_next from any LAN/IP/hostname (Next rejects bare "*").
  // Tighten before sharing this machine on an untrusted network.
  allowedDevOrigins: ["**.*"],
};

export default nextConfig;
