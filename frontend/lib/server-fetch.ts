import { getApiBase } from "./api-base";

/** Default ISR window for public marketplace / activity pages (seconds). */
export const PUBLIC_PAGE_REVALIDATE = 60;

export function fetchPublic(path: string, init?: RequestInit) {
  return fetch(`${getApiBase()}${path}`, {
    ...init,
    next: { revalidate: PUBLIC_PAGE_REVALIDATE },
  });
}
