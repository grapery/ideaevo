import type { NextConfig } from "next";

function apiRewriteOrigin(): string {
  const raw = process.env.API_URL || "http://localhost:8090";
  return raw.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

// Lint is run as a separate CI step (with continue-on-error). Don't let it
// abort the production build — `next build` otherwise fails on any ESLint error.
// (Next 16's `NextConfig` type doesn't include `eslint`, so we cast.)
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Browser calls same-origin /api/*; Next proxies to the Go API (no CORS / cookie issues).
  async rewrites() {
    const origin = apiRewriteOrigin();
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
  // SSR reads API_URL from the repo-root .env when running `make web`.
  env: {
    API_URL: process.env.API_URL,
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
