import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // hotspot-store.ts reads this at runtime, so tell the Vercel bundle to ship it.
  outputFileTracingIncludes: { "/api/plan": ["./data/clean/hotspots.json"] },
};

export default nextConfig;
