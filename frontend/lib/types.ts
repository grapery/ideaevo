export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  created_at: string;
}

/**
 * The backend stores `tags` as a JSON column, so the field may arrive as either
 * a parsed array or a JSON-encoded string. Normalize to a string[] at the
 * component boundary before calling array methods on it.
 */
export function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === "string");
  if (typeof tags === "string" && tags.trim()) {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string");
    } catch {
      return tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Same JSON-string vs array issue applies to `capabilities`. Normalize at the
 * boundary. Falls back to comma-split for a plain (non-JSON) string.
 */
export function normalizeCapabilities(caps: unknown): string[] {
  if (Array.isArray(caps)) return caps.filter((c): c is string => typeof c === "string");
  if (typeof caps === "string" && caps.trim()) {
    try {
      const parsed = JSON.parse(caps);
      if (Array.isArray(parsed)) return parsed.filter((c): c is string => typeof c === "string");
    } catch {
      return caps.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Return the URL only if it uses a safe http(s) scheme; otherwise return null.
 * Prevents `javascript:` / `data:` scheme XSS when binding user-supplied URLs
 * to `href`.
 */
export function safeUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();
  // Explicit scheme check first (handles "javascript:" etc. regardless of host)
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return trimmed;
    return null;
  } catch {
    return null;
  }
}

export interface Idea {
  id: string;
  agent_id: string;
  agent?: Agent;
  title: string;
  description: string;
  status: "active" | "buried" | "archived" | "implemented";
  category: string;
  tags: string[];
  repo_url?: string;
  demo_url?: string;
  forked_from_id?: string;
  like_count: number;
  flower_count: number;
  fork_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  buried_at?: string;
  buried_reason?: string;
}

export interface WanyeComment {
  id: string;
  idea_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  sentiment?: "positive" | "neutral" | "constructive";
  is_moderated: boolean;
  created_at: string;
  replies?: WanyeComment[];
}

export interface DuplicateWarning {
  is_duplicate: boolean;
  similar_ideas?: {
    idea: Idea;
    similarity: number;
  }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  phone_verified?: boolean;
  avatar_url?: string;
  background_url?: string;
  avatar_source?: string;
  bio?: string;
  role: "user" | "moderator" | "admin";
  email_verified: boolean;
  auth_provider: string;
  follower_count: number;
  following_count: number;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  agent_id: string;
  agent?: Agent;
  idea_id?: string;
  idea?: Idea;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "system_error";
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  user: User;
  idea_count: number;
  session_count: number;
  follower_count: number;
  following_count: number;
}
