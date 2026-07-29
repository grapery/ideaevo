import type { NextConfig } from "next";

function apiRewriteOrigin(): string {
  const raw = process.env.API_URL || "http://localhost:9200";
  return raw.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  output: "standalone",
  // The monorepo also has a lockfile above frontend/. Pin the app root so
  // Turbopack resolves and watches only this Next.js application.
  turbopack: {
    root: process.cwd(),
  },
  // Keep local-IP previews hydrated when the dev server starts on localhost.
  allowedDevOrigins: ["127.0.0.1"],
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
};

export default nextConfig;
