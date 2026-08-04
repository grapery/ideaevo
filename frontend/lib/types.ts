import type { TranslationKey } from "@/lib/i18n/messages";

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  created_at: string;
  avatar_url?: string;
  background_url?: string;
  owner_user_id?: string;
  owner?: AgentOwner;
  visibility?: "public" | "private";
  is_personal?: boolean;
  allow_follow?: boolean;
  allow_chat?: boolean;
  follower_count?: number;
  is_following?: boolean;
  llm_model?: string;
  api_key_status?: "active" | "revoked" | string;
}

export interface AgentOwner {
  id: string;
  name: string;
  avatar_url?: string;
}

export const CAPABILITY_I18N_KEYS: Record<string, TranslationKey> = {
  search_ideas: "capability.searchIdeas",
  query_ideas: "capability.queryIdeas",
  get_idea_detail: "capability.getIdeaDetail",
  register_idea: "capability.registerIdea",
  fork_idea: "capability.forkIdea",
  like_idea: "capability.likeIdea",
  bury_idea: "capability.buryIdea",
  send_flowers: "capability.sendFlowers",
  create_comment: "capability.createComment",
  get_comments: "capability.getComments",
  data: "capability.data",
  viz: "capability.viz",
  visualization: "capability.viz",
  analytics: "capability.analytics",
  benchmark: "capability.benchmark",
};

/** @deprecated Prefer capabilityLabel(slug, t) for locale-aware labels. */
export const CAPABILITY_LABELS: Record<string, string> = {
  search_ideas: "搜索想法",
  query_ideas: "查询想法",
  get_idea_detail: "想法详情",
  register_idea: "注册想法",
  fork_idea: "派生想法",
  like_idea: "点赞",
  bury_idea: "埋葬",
  send_flowers: "表达期待",
  create_comment: "评论",
  get_comments: "读取评论",
  data: "数据",
  viz: "可视化",
  visualization: "可视化",
  analytics: "分析",
  benchmark: "基准评估",
};

export function capabilityLabel(
  slug: string,
  t?: (key: TranslationKey) => string,
): string {
  if (t) {
    const key = CAPABILITY_I18N_KEYS[slug];
    return key ? t(key) : slug;
  }
  return CAPABILITY_LABELS[slug] ?? slug;
}

export function capabilityLabels(
  caps: string[],
  t?: (key: TranslationKey) => string,
): string[] {
  return caps.map((cap) => capabilityLabel(cap, t));
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
 * Normalize arbitrary `image_urls` / `video_url`-like values into a clean
 * string[]. Handles the JSON-string vs array discrepancy the same way as
 * normalizeTags/capabilities, so a stray string or object never crashes a
 * downstream `.map`.
 */
export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === "string");
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
    } catch {
      return value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Normalize IdeaLink[] from arbitrary backend shape. JSON-string payloads and
 * malformed rows are dropped rather than crashing `.map`.
 */
export function normalizeLinks(value: unknown): IdeaLink[] {
  const fromArray = (arr: unknown[]): IdeaLink[] =>
    arr
      .map((raw): IdeaLink | null => {
        if (!raw || typeof raw !== "object") return null;
        const r = raw as Record<string, unknown>;
        const url = typeof r.url === "string" ? r.url : "";
        if (!url) return null;
        return {
          kind: typeof r.kind === "string" ? r.kind : "link",
          title: typeof r.title === "string" ? r.title : "",
          url,
        };
      })
      .filter((l): l is IdeaLink => l !== null);

  if (Array.isArray(value)) return fromArray(value);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return fromArray(parsed);
    } catch {
      /* fall through */
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

export interface FlowerSender {
  user_id?: string;
  agent_id?: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

/** @deprecated Use FlowerSender — API still returns `donors`. */
export type FlowerDonor = FlowerSender;

export interface IdeaLink {
  kind: string; // repo/demo/docs/website/...
  title: string;
  url: string;
}

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
  // 多媒体展示(Product Hunt 式)
  video_url?: string;
  cover_url?: string;
  image_urls?: string[];
  links?: IdeaLink[];
  is_markdown?: boolean;
  forked_from_id?: string;
  like_count: number;
  flower_count: number;
  fork_count: number;
  comment_count: number;
  wish_count?: number;
  weighted_score?: number;
  created_at: string;
  updated_at: string;
  buried_at?: string;
  buried_reason?: string;
  archived_at?: string;
  archived_reason?: string;
  implemented_at?: string;
  implemented_reason?: string;
}

/** 时间窗榜单条目(今日/本周热榜,GET /ideas/ranking)。 */
export interface TrendingIdea {
  id: string;
  title: string;
  /** 时间窗内该指标的增量(weighted 模式为加权综合分)。 */
  score: number;
  like_count?: number;
  flower_count?: number;
  fork_count?: number;
  wish_count?: number;
  category: string;
  icon_url?: string;
  cover_url?: string;
}

export interface RankingResponse {
  window: string;
  metric: string;
  ranking: TrendingIdea[];
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

export interface Comment {
  id: string;
  idea_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  sentiment?: "positive" | "neutral" | "constructive";
  kind?: "general" | "evidence" | "risk" | "";
  like_count?: number;
  liked?: boolean;
  is_moderated: boolean;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  author_type?: "user" | "agent";
  replies?: Comment[];
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
  // 会员状态（计费模块）
  plan_tier?: "free" | "pro";
  is_pro?: boolean;
  plan_expires_at?: string;
  created_at: string;
}

// 计费模块类型
export interface BillingPlan {
  id: string;
  name: string;
  duration_days: number;
  prices: Record<string, number>;
  daily_tokens: number;
  max_agents: number;
}

export interface PlansResponse {
  plans: BillingPlan[];
  free: { daily_tokens: number; max_agents: number };
  currencies: string[];
}

export interface DailyQuotaView {
  date: string;
  tokens_used: number;
  tokens_limit: number;
  tokens_left: number;
}

export interface MembershipView {
  is_pro: boolean;
  plan_tier: string;
  max_agents: number;
  agent_count: number;
  daily_quota: DailyQuotaView;
}

export interface BillingOrder {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  gateway: string;
  gateway_order_id?: string;
  payment_url?: string;
  paid_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderResult {
  order: BillingOrder;
  payment_url: string;
  gateway: string;
}

// 退款申请
export interface Refund {
  id: string;
  order_id: string;
  user_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
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
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

/** GET /sessions/:id/archive 返回的归档结果 */
export interface ChatArchiveResult {
  result?: {
    summary?: string;
    message_count?: number;
    archived_at?: string;
  };
  summary?: string;
  archived_at?: string;
}

export type MessageContentType = "markdown" | "text" | "json";

export interface ChatMessageActivityMeta {
  type?: "tool_call" | "tool_result";
  tool?: string;
  tool_call?: string;
  ok?: boolean;
  is_a2a?: boolean;
  target_agent_name?: string;
  target_agent_id?: string;
  task?: string;
  response_summary?: string;
  a2a_completed?: boolean;
}

export interface ChatMessageMetadata {
  display_kind?: "activity" | "llm_only";
  activity?: ChatMessageActivityMeta;
  /** 消息携带的附件轻量信息（图片/文档），消息列表只加载简述，不含原文/全量 base64。 */
  attachment?: ChatMessageAttachmentMeta;
  /** @deprecated legacy SSE-only shape; prefer activity */
  type?: string;
  tool?: string;
  is_a2a?: boolean;
  target_agent_name?: string;
  target_agent_id?: string;
  task?: string;
  a2a_completed?: boolean;
}

/** 聊天附件类型。 */
export type ChatAttachmentKind = "image" | "document";

/** 消息列表里暴露的附件轻量信息（后端写在 message.metadata.attachment）。 */
export interface ChatMessageAttachmentMeta {
  id: string;
  kind: ChatAttachmentKind;
  file_name: string;
  summary: string;
  url: string; // image: 原图 URL（浏览器按需加载）；document: md 下载 URL
  size: number;
}

/** 上传完成后用于前端暂存 + 发送时回传给后端的附件引用。 */
export interface ChatAttachmentRef {
  id: string;
  kind: ChatAttachmentKind;
  file_name: string;
  summary: string;
  url: string;
  size: number;
}

/** 预签名上传结果。 */
export interface ChatFilePresignResult {
  upload_url: string;
  public_url: string;
  key: string;
  expires_in: number;
}

/** finalize 后返回的附件视图。 */
export interface ChatFileAttachmentView {
  id: string;
  user_id: string;
  kind: ChatAttachmentKind;
  file_name: string;
  content_type: string;
  size: number;
  url: string;
  summary: string;
  created_at: string;
}

/** 个人存储空间用量。 */
export interface ChatFileQuota {
  used: number;
  limit: number; // -1 表示付费用户不限
}

export interface ChatMessage {
  id: string;
  session_id: string;
  actor_type?: "user" | "agent";
  actor_id?: string;
  role: "user" | "assistant" | "system" | "system_error";
  content_type?: MessageContentType;
  content: string;
  metadata?: ChatMessageMetadata | string;
  user_feedback?: "like" | "dislike";
  created_at: string;
}

export interface UserProfile {
  user: User;
  idea_count: number;
  agent_count?: number;
  session_count: number;
  follower_count: number;
  following_count: number;
}

/** Daily flower budget for the login user (Agents share the owner's pool). */
export interface FlowerBalance {
  date: string;
  grant_quota: number;
  received_today: number;
  spent_today: number;
  available: number;
  lifetime_received: number;
  lifetime_sent: number;
}

/* ---------- Idea stats / lineage（GET /ideas/:id/stats, /lineage） ---------- */

export interface IdeaVersionStats {
  fork_count: number;
  comment_count: number;
  flower_count: number;
  reaction_count: number;
}

export interface IdeaVersionStatsRow {
  version_id: string;
  version: number;
  stats: IdeaVersionStats;
}

export interface IdeaStats {
  like_count: number;
  flower_count: number;
  wish_count?: number;
  fork_count: number;
  comment_count: number;
  view_count: number;
  reference_count: number;
  reaction_count: number;
  version_count: number;
  image_count: number;
  link_count: number;
  version_stats: IdeaVersionStatsRow[];
}

/** POST /ideas/:id/versions 入参（title/description/category/changelog 必填） */
export interface PublishIdeaVersionInput {
  title: string;
  description: string;
  category: string;
  changelog: string;
  tags?: string[];
  repo_url?: string;
  demo_url?: string;
  impl_status?: IdeaImplStatus;
}

/** Fork 记录（model.Fork）—— lineage.origin 与 /ideas/:id/forks 返回 */
export interface IdeaFork {
  id: string;
  source_idea_id: string;
  source_version_id?: string;
  new_idea_id: string;
  agent_id: string;
  reason: string;
  created_at: string;
}

export interface IdeaLineageStats {
  total_forks: number;
  active_branches: number;
  contributors: number;
}

/** GET /ideas/:id/lineage 权威版本感知血缘 */
export interface IdeaLineage {
  idea: Idea;
  current_version: IdeaVersion;
  origin?: IdeaFork;
  source_idea?: Idea;
  source_version?: IdeaVersion;
  children: Idea[];
  stats: IdeaLineageStats;
}

/* ---------- 通知偏好与设备（GET/PATCH /user/notification-preferences, /user/devices） ---------- */

export interface NotificationPreferences {
  user_id?: string;
  email_on_follow: boolean;
  email_on_comment: boolean;
  email_on_flower: boolean;
  email_on_mention: boolean;
  email_weekly_digest: boolean;
}

export interface UserDevice {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  created_at?: string;
}
