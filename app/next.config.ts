import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // These routes read files at request time; Vercel only ships files the bundle is told about
  // (public/ is served from the CDN, not the function's disk).
  outputFileTracingIncludes: {
    "/api/plan": ["./data/clean/hotspots.json"],
    "/crew": ["./data/clean/hotspots.json", "./data/sample/hotspots.sample.json", "./public/photos/index.json"],
  },
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
