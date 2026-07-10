/** DiceBear 9.x defaults — keep in sync with backend/internal/service/avatar_defaults.go */

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

export type EntityKind = "user" | "agent" | "idea";

function encodeSeed(id: string): string {
  return encodeURIComponent(id);
}

export function defaultUserAvatarURL(userId: string): string {
  return `${DICEBEAR_BASE}/lorelei/svg?seed=${encodeSeed(userId)}`;
}

export function defaultAgentAvatarURL(agentId: string): string {
  return `${DICEBEAR_BASE}/bottts/svg?seed=${encodeSeed(agentId)}`;
}

export function defaultIdeaIconURL(ideaId: string): string {
  return `${DICEBEAR_BASE}/shapes/svg?seed=${encodeSeed(ideaId)}&backgroundColor=e8efe9,6b8cae,d4a04a`;
}

export function defaultEntityMediaURL(kind: EntityKind, id: string): string {
  switch (kind) {
    case "user":
      return defaultUserAvatarURL(id);
    case "agent":
      return defaultAgentAvatarURL(id);
    case "idea":
      return defaultIdeaIconURL(id);
  }
}

/** Prefer API value; fall back to DiceBear when empty (SSR / stale cache). */
export function resolveEntityMediaURL(
  kind: EntityKind,
  id: string,
  rawUrl?: string | null
): string {
  const trimmed = rawUrl?.trim();
  if (trimmed) return trimmed;
  if (!id) return "";
  return defaultEntityMediaURL(kind, id);
}
