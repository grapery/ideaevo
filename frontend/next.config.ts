import type { NextConfig } from "next";

// Lint is run as a separate CI step (with continue-on-error). Don't let it
// abort the production build — `next build` otherwise fails on any ESLint error.
// (Next 16's `NextConfig` type doesn't include `eslint`, so we cast.)
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Reduce repeated RSC revalidation when prefetch is triggered
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
} as NextConfig;

export default nextConfig;
