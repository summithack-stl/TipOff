import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // hotspot-store.ts reads this at runtime, so tell the Vercel bundle to ship it.
  outputFileTracingIncludes: { "/api/plan": ["./data/clean/hotspots.json"] },
  // Basic hardening for every response. Same-origin framing still works for our own views.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
