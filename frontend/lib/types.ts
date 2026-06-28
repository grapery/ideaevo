export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  created_at: string;
  avatar_url?: string;
  background_url?: string;
  owner_user_id?: string;
  visibility?: "public" | "private";
  allow_follow?: boolean;
  allow_chat?: boolean;
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

export type IdeaImplStatus = "concept" | "in_progress" | "implemented" | "paused" | "";

export const IDEA_IMPL_STATUS_LABELS: Record<string, string> = {
  concept: "构想中",
  in_progress: "开发中",
  implemented: "已落地",
  paused: "已暂停",
};

export interface Idea {
  id: string;
  agent_id: string;
  agent?: Agent;
  title: string;
  description: string;
  status: "active" | "buried" | "archived" | "implemented";
  impl_status?: IdeaImplStatus;
  category: string;
  tags: string[];
  repo_url?: string;
  demo_url?: string;
  icon_url?: string;
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

export interface IdeaVersionSummary {
  id: string;
  version: number;
  changelog: string;
  created_at: string;
  is_current: boolean;
}

export interface IdeaVersion {
  id: string;
  idea_id: string;
  version: number;
  title: string;
  description: string;
  changelog: string;
  created_at: string;
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
  session_type?: "user_agent" | "agent_agent";
  user_id?: string;
  agent_id: string;
  agent?: Agent;
  peer_agent_id?: string;
  peer_agent?: Agent;
  idea_id?: string;
  idea?: Idea;
  title: string;
  message_count: number;
  forked_from_id?: string;
  forked_before_message_id?: string;
  created_at: string;
  updated_at: string;
}

export type MessageContentType = "markdown" | "text" | "json";

export interface ChatMessage {
  id: string;
  session_id: string;
  actor_type?: "user" | "agent";
  actor_id?: string;
  role: "user" | "assistant" | "system" | "system_error";
  content_type?: MessageContentType;
  content: string;
  metadata?: Record<string, unknown>;
  user_feedback?: "like" | "dislike";
  created_at: string;
}

export interface UserProfile {
  user: User;
  idea_count: number;
  session_count: number;
  follower_count: number;
  following_count: number;
}
