const DEFAULT_API_BASE = "http://localhost:8080/api";

/** Normalize origin or /api URL to a base ending with /api (SSR + CSR). */
export function getApiBase(): string {
  const raw =
    (typeof window !== "undefined"
      ? window.__ENV_API_URL__
      : process.env.API_URL) || DEFAULT_API_BASE;

  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}
