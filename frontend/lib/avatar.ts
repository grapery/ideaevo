import {
  generateEntityAvatarDataUrl,
  isLegacyDefaultAvatarUrl,
} from "@/lib/entity-avatar-generator.mjs";

/** Deterministic entity media defaults. Users keep the portrait fallback;
 * Idea and Agent defaults are generated locally from stable entity ids. */

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

export type EntityKind = "user" | "agent" | "idea";

function encodeSeed(id: string): string {
  return encodeURIComponent(id);
}

export function defaultUserAvatarURL(userId: string): string {
  return `${DICEBEAR_BASE}/lorelei/svg?seed=${encodeSeed(userId)}`;
}

export function defaultAgentAvatarURL(agentId: string): string {
  return generateEntityAvatarDataUrl("agent", agentId);
}

export function defaultIdeaIconURL(ideaId: string): string {
  return generateEntityAvatarDataUrl("idea", ideaId);
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
  if (trimmed && !((kind === "idea" || kind === "agent") && isLegacyDefaultAvatarUrl(trimmed))) {
    return trimmed;
  }
  if (!id) return "";
  return defaultEntityMediaURL(kind, id);
}
