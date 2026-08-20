import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, not built output.
  transpilePackages: ["@double-a/shared-types", "@double-a/api-client", "@double-a/ui"],
  typedRoutes: true,
  // textract shells out to tesseract — keep it external so Next does not bundle it.
  serverExternalPackages: ["textract"],
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
