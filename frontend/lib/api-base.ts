const DEFAULT_API_ORIGIN = "http://localhost:8090";

/** Normalize origin or /api URL to a base ending with /api (SSR + CSR). */
export function getApiBase(): string {
  // Client: same-origin /api is proxied by Next.js (see next.config rewrites).
  if (typeof window !== "undefined") {
    return "/api";
  }

  const fromEnv = process.env.API_URL;
  const raw =
    fromEnv && fromEnv !== "__API_URL__" ? fromEnv : DEFAULT_API_ORIGIN;

  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}
