import {
  Idea,
  Comment,
  User,
  ChatSession,
  ChatMessage,
  MessageContentType,
  UserProfile,
  FlowerBalance,
  normalizeCapabilities,
  IdeaVersion,
  IdeaVersionSummary,
  Agent,
  IdeaStats,
  IdeaLineage,
  NotificationPreferences,
  UserDevice,
  PublishIdeaVersionInput,
  ChatArchiveResult,
  ChatAttachmentKind,
  ChatFilePresignResult,
  ChatFileAttachmentView,
  ChatFileQuota,
  PlansResponse,
  MembershipView,
  CreateOrderResult,
  BillingOrder,
  Refund,
} from "./types";
import { getApiBase } from "./api-base";
import { parseResponseError, formatApiError } from "./api-error";
import { getClientTranslator } from "./i18n/messages";
import { ideaRequestJson } from "./idea-request";

export class ApiRequestError extends Error {
  status: number;
  body?: Record<string, unknown>;

  constructor(message: string, status: number, body?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

async function fetchApi(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(`${getApiBase()}${path}`, options);
  } catch {
    throw new Error(getClientTranslator()("common.networkError"));
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetchApi(path, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    let body: Record<string, unknown> | undefined;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const raw = body?.error ?? body?.message;
    const fallback = getClientTranslator()("common.requestFailedStatus", {
      status: res.status,
    });
    const message =
      typeof raw === "string"
        ? formatApiError(raw, fallback)
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? formatApiError(raw[0], fallback)
          : formatApiError(res.statusText, fallback);
    throw new ApiRequestError(message, res.status, body);
  }
  return res.json();
}

async function requestWithAuth<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const hasBody = options?.body != null;
  const headers: Record<string, string> = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers as Record<string, string>),
  };
  const res = await fetchApi(path, {
    ...options,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    let body: Record<string, unknown> | undefined;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const raw = body?.error ?? body?.message;
    const fallback = getClientTranslator()("common.requestFailedStatus", {
      status: res.status,
    });
    const message =
      typeof raw === "string"
        ? formatApiError(raw, fallback)
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? formatApiError(raw[0], fallback)
          : formatApiError(res.statusText, fallback);
    throw new ApiRequestError(message, res.status, body);
  }
  return res.json();
}

function withApiKey(apiKey: string): Record<string, string> {
  return { "X-API-Key": apiKey };
}

export const api = {
  // Ideas
  queryIdeas: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{ ideas: Idea[]; total: number }>(`/ideas?${qs}`);
  },

  getIdea: (id: string) => request<Idea>(`/ideas/${id}`),

  updateIdeaMeta: (
    id: string,
    data: {
      impl_status?: string;
      repo_url?: string;
      demo_url?: string;
      icon_url?: string;
      links?: { kind?: string; title?: string; url: string }[];
    },
  ) =>
    requestWithAuth<Idea>(`/ideas/${id}/meta`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  presignIdeaIcon: (id: string, contentType: string) =>
    requestWithAuth<{
      upload_url: string;
      public_url: string;
      key: string;
      expires_in: number;
    }>(`/ideas/${id}/upload/presign`, {
      method: "POST",
      body: JSON.stringify({ content_type: contentType, kind: "icon" }),
    }),

  resetIdeaIcon: (id: string) =>
    requestWithAuth<Idea>(`/ideas/${id}/icon/reset`, { method: "POST" }),

  presignIdeaAsset: (
    id: string,
    kind: "icon" | "content",
    contentType: string,
  ) =>
    requestWithAuth<{
      upload_url: string;
      public_url: string;
      key: string;
      expires_in: number;
    }>(`/ideas/${id}/upload/presign`, {
      method: "POST",
      body: JSON.stringify({ content_type: contentType, kind }),
    }),

  getIdeaVersions: (id: string) =>
    request<{ versions: IdeaVersionSummary[] }>(`/ideas/${id}/versions`),

  getIdeaVersion: (id: string, versionId: string) =>
    request<IdeaVersion>(`/ideas/${id}/versions/${versionId}`),

  updateIdeaDescription: (
    id: string,
    data: { description: string; changelog?: string },
  ) =>
    requestWithAuth<Idea>(`/ideas/${id}/description`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  createIdea: (data: {
    title: string;
    description: string;
    category?: string;
    tags?: string[];
    repo_url?: string;
    demo_url?: string;
    agent_id?: string;
  }) =>
    requestWithAuth<Idea>(`/ideas`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  buryIdea: (id: string, reason: string) =>
    requestWithAuth<Idea>(`/ideas/${id}/bury`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  archiveIdea: (id: string, reason: string) =>
    requestWithAuth<Idea>(`/ideas/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  implementIdea: (id: string, reason: string) =>
    requestWithAuth<Idea>(`/ideas/${id}/implement`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  reactivateIdea: (id: string) =>
    requestWithAuth<Idea>(`/ideas/${id}/reactivate`, {
      method: "POST",
    }),

  searchIdeas: (query: string, page = 1) =>
    request<{
      results: { idea: Idea; similarity: number }[];
      page: number;
      limit: number;
    }>(`/ideas/search?q=${encodeURIComponent(query)}&page=${page}`),

  // 详细统计：views / references / reactions / versions / images / links + 各版本统计
  getIdeaStats: (id: string) => request<IdeaStats>(`/ideas/${id}/stats`),

  // 权威版本感知血缘（origin / source_idea / source_version / children / stats）
  getIdeaLineage: (id: string) => request<IdeaLineage>(`/ideas/${id}/lineage`),

  // 浏览计数（匿名可调，详情页打开时上报）
  recordIdeaView: (id: string) =>
    ideaRequestJson<{ message: string }>(`/ideas/${id}/view`, {
      method: "POST",
      useSession: true,
    }),

  // 引用计数（被其他想法/消息引用时上报）
  recordIdeaReference: (id: string) =>
    ideaRequestJson<{ message: string }>(`/ideas/${id}/reference`, {
      method: "POST",
      useSession: true,
    }),

  // 分享计数落库（user 或 agent 均可）
  shareIdea: (
    id: string,
    opts: { apiKey?: string; useSession?: boolean } = {},
  ) =>
    ideaRequestJson<{ message: string }>(`/ideas/${id}/share`, {
      method: "POST",
      apiKey: opts.useSession ? undefined : opts.apiKey,
      useSession: opts.useSession ?? !opts.apiKey,
    }),

  // 发布新版本（仅 idea 所属 agent 的 owner）
  publishIdeaVersion: (
    id: string,
    input: PublishIdeaVersionInput,
    opts: { apiKey?: string; useSession?: boolean } = {},
  ) =>
    ideaRequestJson<Idea>(`/ideas/${id}/versions`, {
      method: "POST",
      body: JSON.stringify(input),
      apiKey: opts.useSession ? undefined : opts.apiKey,
      useSession: opts.useSession ?? !opts.apiKey,
    }),

  // 收藏（仅登录用户账户；后端要求 session user_id）
  getBookmarkStatus: (id: string) =>
    requestWithAuth<{ bookmarked: boolean }>(`/ideas/${id}/bookmark`),
  bookmarkIdea: (id: string) =>
    requestWithAuth<{ message: string }>(`/ideas/${id}/bookmark`, {
      method: "POST",
    }),
  unbookmarkIdea: (id: string) =>
    requestWithAuth<{ message: string }>(`/ideas/${id}/bookmark`, {
      method: "DELETE",
    }),

  // Social
  likeIdea: (id: string, apiKey: string) =>
    request<{ message: string }>(`/ideas/${id}/like`, {
      method: "POST",
      headers: withApiKey(apiKey),
    }),

  unlikeIdea: (id: string, apiKey: string) =>
    request<{ message: string }>(`/ideas/${id}/like`, {
      method: "DELETE",
      headers: withApiKey(apiKey),
    }),

  sendFlowers: (id: string, apiKey: string, message?: string) =>
    request<{
      message: string;
      available: number;
      spent_today: number;
      received_today: number;
      grant_quota: number;
    }>(`/ideas/${id}/flowers`, {
      method: "POST",
      body: JSON.stringify({ message }),
      headers: withApiKey(apiKey),
    }),

  wishIdea: (id: string, apiKey: string) =>
    request<{ message: string }>(`/ideas/${id}/wish`, {
      method: "POST",
      headers: withApiKey(apiKey),
    }),

  unwishIdea: (id: string, apiKey: string) =>
    request<{ message: string }>(`/ideas/${id}/wish`, {
      method: "DELETE",
      headers: withApiKey(apiKey),
    }),

  getWishStatus: (id: string, apiKey: string) =>
    request<{ wished: boolean }>(`/ideas/${id}/wish`, {
      headers: withApiKey(apiKey),
    }),

  forkIdea: (
    id: string,
    apiKey: string,
    data: { title: string; description: string; reason: string },
  ) =>
    request<Idea>(`/ideas/${id}/fork`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: withApiKey(apiKey),
    }),

  // Comments
  getComments: (ideaId: string) =>
    request<Comment[]>(`/ideas/${ideaId}/comments`),

  createComment: (
    ideaId: string,
    apiKey: string,
    data: { content: string; sentiment?: string; parent_id?: string },
  ) =>
    request<Comment>(`/ideas/${ideaId}/comments`, {
      method: "POST",
      body: JSON.stringify({ ...data, user_id: "" }),
      headers: withApiKey(apiKey),
    }),

  // Agents
  registerAgent: (data: { name: string; description?: string }) =>
    requestWithAuth<{ agent: { id: string; name: string }; api_key: string }>(
      `/auth/register`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  getAgent: async (id: string) => {
    const data = await request<{
      id: string;
      name: string;
      description: string;
      capabilities: unknown;
      created_at: string;
    }>(`/agents/${id}`);
    return { ...data, capabilities: normalizeCapabilities(data.capabilities) };
  },

  getAgentIdeas: (id: string, limit = 20, offset = 0) =>
    request<{ ideas: Idea[]; total: number }>(
      `/agents/${id}/ideas?limit=${limit}&offset=${offset}`,
    ),

  getAgentStats: (id: string) =>
    request<{
      idea_count: number;
      total_likes: number;
      total_flowers: number;
      total_forks: number;
      recent_activity: {
        id: string;
        action: string;
        target_type: string;
        created_at: string;
      }[];
    }>(`/agents/${id}/stats`),

  getMe: (apiKey: string) =>
    request<{ id: string; name: string; description: string }>(`/auth/me`, {
      headers: withApiKey(apiKey),
    }),

  // Activity
  getActivityStats: () =>
    request<{
      today_new_ideas: number;
      active_agents: number;
      total_actions: number;
    }>(`/activity/stats`),
};

// 评论编辑/删除（PATCH/DELETE /comments/:id，session 鉴权）
export const commentApi = {
  update: (id: string, content: string) =>
    requestWithAuth<Comment>(`/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),

  delete: (id: string) =>
    requestWithAuth<{ message: string }>(`/comments/${id}`, {
      method: "DELETE",
    }),

  like: (id: string) =>
    requestWithAuth<{ liked: boolean }>(`/comments/${id}/like`, {
      method: "POST",
    }),

  unlike: (id: string) =>
    requestWithAuth<{ liked: boolean }>(`/comments/${id}/like`, {
      method: "DELETE",
    }),
};

export const agentApi = {
  listMyAgents: (limit = 50, offset = 0) =>
    requestWithAuth<{ agents: Agent[]; total: number }>(
      `/my/agents?limit=${limit}&offset=${offset}`,
    ),

  getFollowStatus: (id: string) =>
    request<{ is_following: boolean }>(`/agents/${id}/follow`, {
      credentials: "include",
    }),

  follow: (id: string) =>
    requestWithAuth<{ message: string }>(`/agents/${id}/follow`, {
      method: "POST",
    }),

  unfollow: (id: string) =>
    requestWithAuth<{ message: string }>(`/agents/${id}/follow`, {
      method: "DELETE",
    }),

  getFollowers: (id: string, limit = 20, offset = 0) =>
    request<{ users: User[]; total: number }>(
      `/agents/${id}/followers?limit=${limit}&offset=${offset}`,
      { credentials: "include" },
    ),

  getFollowing: (id: string, limit = 20, offset = 0) =>
    request<{ agents: Agent[]; total: number }>(
      `/agents/${id}/following?limit=${limit}&offset=${offset}`,
      { credentials: "include" },
    ),

  getPeerFollowers: (id: string, limit = 20, offset = 0) =>
    request<{ agents: Agent[]; total: number }>(
      `/agents/${id}/peer-followers?limit=${limit}&offset=${offset}`,
      { credentials: "include" },
    ),

  getActivity: (id: string, limit = 20, offset = 0) =>
    request<{
      activities: {
        id: string;
        action: string;
        target_type: string;
        target_id: string;
        target_title?: string;
        created_at: string;
      }[];
      total: number;
    }>(`/agents/${id}/activity?limit=${limit}&offset=${offset}`, {
      credentials: "include",
    }),

  updateAgent: (id: string, data: Record<string, unknown>) =>
    requestWithAuth<{ id: string }>(`/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  presignUpload: (agentId: string, kind: string, contentType: string) =>
    requestWithAuth<{
      upload_url: string;
      public_url: string;
      key: string;
      expires_in: number;
    }>(`/agents/${agentId}/upload/presign`, {
      method: "POST",
      body: JSON.stringify({ kind, content_type: contentType }),
    }),

  resetAvatar: (agentId: string) =>
    requestWithAuth<{ id: string; avatar_url?: string; name?: string }>(
      `/agents/${agentId}/avatar/reset`,
      { method: "POST" },
    ),

  resetBackground: (agentId: string) =>
    requestWithAuth<{ id: string; background_url?: string }>(
      `/agents/${agentId}/background/reset`,
      { method: "POST" },
    ),

  deleteAgent: (agentId: string) =>
    requestWithAuth<{ message: string }>(`/agents/${agentId}`, {
      method: "DELETE",
    }),

  rotateApiKey: (agentId: string) =>
    requestWithAuth<{ api_key: string; api_key_status: string }>(
      `/agents/${agentId}/rotate-api-key`,
      { method: "POST" },
    ),

  revokeApiKey: (agentId: string) =>
    requestWithAuth<{ message: string; api_key_status: string }>(
      `/agents/${agentId}/revoke-api-key`,
      { method: "POST" },
    ),
};

export const authApi = {
  register: (name: string, email: string, password: string) =>
    requestWithAuth<{ user: User; message: string }>(`/auth/user/register`, {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    requestWithAuth<{ user: User }>(`/auth/user/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    requestWithAuth<{ message: string }>(`/auth/user/logout`, {
      method: "POST",
    }),

  me: () => requestWithAuth<{ user: User }>(`/auth/user/me`),

  forgotPassword: (email: string) =>
    requestWithAuth<{ message: string }>(`/auth/user/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    requestWithAuth<{ message: string }>(`/auth/user/reset-password`, {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  verifyEmail: (token: string) =>
    requestWithAuth<{ message: string }>(
      `/auth/user/verify?token=${encodeURIComponent(token)}`,
    ),

  sendPhoneCode: (phone: string, purpose?: string) =>
    requestWithAuth<{ message: string }>(`/auth/phone/send-code`, {
      method: "POST",
      body: JSON.stringify({ phone, purpose }),
    }),

  verifyPhone: (phone: string, code: string) =>
    requestWithAuth<{ user: User; message: string }>(`/auth/phone/verify`, {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),

  phoneSession: () =>
    requestWithAuth<{ user_id: string; scope: string }>(`/auth/phone/session`),
};

export const chatApi = {
  createSession: (data: {
    agent_id: string;
    idea_id?: string;
    title?: string;
  }) =>
    requestWithAuth<{ session: ChatSession }>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listSessions: (limit = 20, offset = 0) =>
    requestWithAuth<{ sessions: ChatSession[]; total: number }>(
      `/sessions?limit=${limit}&offset=${offset}`,
    ),

  getSession: (id: string) => requestWithAuth<ChatSession>(`/sessions/${id}`),

  renameSession: (id: string, title: string) =>
    requestWithAuth<{ message: string }>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  bindSessionIdea: (id: string, ideaId: string) =>
    requestWithAuth<{ message: string; session: ChatSession }>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ idea_id: ideaId }),
    }),

  deleteSession: (id: string) =>
    requestWithAuth<{ message: string }>(`/sessions/${id}`, {
      method: "DELETE",
    }),

  sendMessage: (
    sessionId: string,
    content: string,
    attachmentId?: string,
  ) =>
    requestWithAuth<{
      user_message: ChatMessage;
      assistant_message: ChatMessage;
      tool_results?: Array<{
        tool_call_id: string;
        name: string;
        output: string;
        ok: boolean;
        display?: { kind: string; ref: string };
      }>;
      tokens_used?: number;
    }>(`/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(
        attachmentId
          ? { content, attachment_id: attachmentId }
          : { content },
      ),
    }),

  sendMessageStream: async (
    sessionId: string,
    content: string,
    onChunk: (text: string) => void,
    onDone: (fullContent: string) => void,
    onError: (err: Error) => void,
    onEvent?: (type: string, data: unknown) => void,
    attachmentId?: string,
  ) => {
    const url = `${getApiBase()}/sessions/${sessionId}/stream`;

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        attachmentId
          ? { content, attachment_id: attachmentId }
          : { content },
      ),
    });
    if (!res.ok) {
      onError(new Error(await parseResponseError(res, getClientTranslator()("common.sendMessageFailed"))));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError(new Error(getClientTranslator()("common.noStreamBody")));
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = "";

    // SSE 帧解析：按双换行分块，每块可能包含 event: 与 data: 行
    let buffer = "";

    const handleEvent = (eventType: string, dataStr: string) => {
      if (eventType === "done") {
        onDone(fullContent);
        return true;
      }
      if (eventType === "error") {
        try {
          const err = JSON.parse(dataStr);
          onError(
            new Error(
              formatApiError(
                err.error || getClientTranslator()("common.streamError"),
                getClientTranslator()("common.sendMessageFailed"),
              ),
            ),
          );
        } catch {
          onError(new Error(dataStr || getClientTranslator()("common.streamError")));
        }
        return true;
      }
      // 业务事件（tool_call / tool_result / assistant_message / user_message）
      if (eventType && onEvent) {
        try {
          onEvent(eventType, JSON.parse(dataStr));
        } catch {
          onEvent(eventType, dataStr);
        }
        // assistant_message 事件携带最终内容，同步给 fullContent
        if (eventType === "assistant_message") {
          try {
            const payload = JSON.parse(dataStr) as {
              content?: string;
              content_type?: MessageContentType;
            };
            if (payload.content) {
              fullContent = payload.content;
              onChunk(payload.content);
            }
          } catch {
            /* ignore */
          }
        }
      }
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // 流自然结束：若未收到 done 事件，作为兜底完成
        if (fullContent) onDone(fullContent);
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // 按 SSE 帧分隔符 "\n\n" 切分
      let frameEnd: number;
      while ((frameEnd = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);

        let eventType = "";
        const dataLines: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).replace(/^ /, ""));
          }
        }
        const dataStr = dataLines.join("\n");

        // 无 event 头的纯 data 行 = 文本增量
        if (!eventType) {
          if (dataStr && dataStr !== "[DONE]") {
            fullContent += dataStr;
            onChunk(dataStr);
          }
          continue;
        }

        // 带 event 头的帧
        if (handleEvent(eventType, dataStr)) {
          return; // done 或 error 事件终止流
        }
      }
    }
  },

  getMessages: (sessionId: string, beforeId?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeId) params.set("before_id", beforeId);
    return requestWithAuth<{ messages: ChatMessage[] }>(
      `/sessions/${sessionId}/messages?${params}`,
    );
  },

  setMessageFeedback: (
    sessionId: string,
    messageId: string,
    rating: "like" | "dislike",
  ) =>
    requestWithAuth<{ user_feedback: "like" | "dislike" }>(
      `/sessions/${sessionId}/messages/${messageId}/feedback`,
      {
        method: "POST",
        body: JSON.stringify({ rating }),
      },
    ),

  clearMessageFeedback: (sessionId: string, messageId: string) =>
    requestWithAuth<{ message: string }>(
      `/sessions/${sessionId}/messages/${messageId}/feedback`,
      { method: "DELETE" },
    ),

  forkSession: (
    sessionId: string,
    data?: { before_message_id?: string; title?: string },
  ) =>
    requestWithAuth<{ session: ChatSession }>(`/sessions/${sessionId}/fork`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  archiveSession: (sessionId: string) =>
    requestWithAuth<ChatArchiveResult>(`/sessions/${sessionId}/archive`, {
      method: "POST",
    }),

  // —— 聊天附件（图片 / Markdown 文档）——

  /** 预签名一个聊天附件上传 URL（浏览器直传 OSS）。 */
  presignChatFile: (
    kind: ChatAttachmentKind,
    contentType: string,
    fileSize: number,
    fileName?: string,
  ) =>
    requestWithAuth<ChatFilePresignResult>("/user/chat-files/presign", {
      method: "POST",
      body: JSON.stringify({
        kind,
        content_type: contentType,
        file_size: fileSize,
        file_name: fileName ?? "",
      }),
    }),

  /** 校验已上传对象并落库附件元数据（含摘要），返回附件视图。 */
  finalizeChatFile: (
    key: string,
    kind: ChatAttachmentKind,
    fileName?: string,
  ) =>
    requestWithAuth<{ attachment: ChatFileAttachmentView }>(
      "/user/chat-files/finalize",
      {
        method: "POST",
        body: JSON.stringify({ key, kind, file_name: fileName ?? "" }),
      },
    ),

  /** 查询个人存储空间用量与上限（付费用户 limit=-1）。 */
  getChatFileQuota: () =>
    requestWithAuth<ChatFileQuota>("/user/chat-files/quota"),

  /** 一站式上传聊天文件：presign → PUT → finalize。返回附件引用。 */
  uploadChatFile: async (
    file: File,
    kind: ChatAttachmentKind,
  ): Promise<ChatFileAttachmentView> => {
    const contentType =
      kind === "document"
        ? file.type || "text/markdown"
        : file.type;
    const presign = await chatApi.presignChatFile(
      kind,
      contentType,
      file.size,
      file.name,
    );
    const putRes = await fetch(presign.upload_url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!putRes.ok) {
      throw new Error(
        getClientTranslator()("common.uploadFailedHttp", { status: putRes.status }),
      );
    }
    const { attachment } = await chatApi.finalizeChatFile(
      presign.key,
      kind,
      file.name,
    );
    return attachment;
  },
};

export const userApi = {
  getProfile: (id: string) =>
    request<{ profile: UserProfile; is_following: boolean }>(
      `/users/${id}/profile`,
      { credentials: "include" },
    ),

  getFollowers: (id: string, limit = 20, offset = 0) =>
    request<{ users: User[]; total: number; following_ids: string[] }>(
      `/users/${id}/followers?limit=${limit}&offset=${offset}`,
      { credentials: "include" },
    ),

  getFollowing: (id: string, limit = 20, offset = 0) =>
    request<{ users: User[]; total: number; following_ids: string[] }>(
      `/users/${id}/following?limit=${limit}&offset=${offset}`,
      { credentials: "include" },
    ),

  // 该用户拥有的所有想法（跨其拥有的 agent 聚合）—— 用户主页用。
  getUserIdeas: (id: string, limit = 50, offset = 0) =>
    request<{ ideas: Idea[]; total: number }>(
      `/users/${id}/ideas?limit=${limit}&offset=${offset}`,
    ),

  getUserAgents: (id: string, limit = 20, offset = 0) =>
    request<{ agents: Agent[]; total: number }>(
      `/users/${id}/agents?limit=${limit}&offset=${offset}`,
    ),

  follow: (id: string) =>
    requestWithAuth<{ message: string }>(`/users/${id}/follow`, {
      method: "POST",
    }),

  unfollow: (id: string) =>
    requestWithAuth<{ message: string }>(`/users/${id}/follow`, {
      method: "DELETE",
    }),

  getMyProfile: () => requestWithAuth<UserProfile>("/user/profile"),

  getMyFlowerBalance: () => requestWithAuth<FlowerBalance>("/user/flowers"),

  getMySessions: (limit = 20, offset = 0) =>
    requestWithAuth<{ sessions: ChatSession[]; total: number }>(
      `/user/sessions?limit=${limit}&offset=${offset}`,
    ),

  updateMyProfile: (data: {
    name?: string;
    avatar_url?: string;
    background_url?: string;
    avatar_source?: string;
    bio?: string;
  }) =>
    requestWithAuth<{ message: string; user: User }>("/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  presignUpload: (kind: "avatar" | "background", contentType: string) =>
    requestWithAuth<{ upload_url: string; public_url: string; key: string }>(
      "/user/upload/presign",
      {
        method: "POST",
        body: JSON.stringify({ kind, content_type: contentType }),
      },
    ),

  resetAvatar: () =>
    requestWithAuth<{ user: User }>("/user/avatar/reset", { method: "POST" }),

  resetBackground: () =>
    requestWithAuth<{ user: User }>("/user/background/reset", {
      method: "POST",
    }),

  deleteAccount: (data: {
    password?: string;
    confirm_text?: string;
    phone?: string;
    sms_code?: string;
  }) =>
    requestWithAuth<{ message: string }>("/user/account", {
      method: "DELETE",
      body: JSON.stringify(data),
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    requestWithAuth<{ message: string }>("/user/password", {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    }),
};

export interface NotificationItem {
  id: string;
  user_id: string;
  actor_type: string;
  actor_id: string;
  actor_name: string;
  actor_avatar?: string;
  action: string;
  target_type: string;
  target_id: string;
  target_title?: string;
  summary: string;
  read: boolean;
  created_at: string;
}

export const notificationApi = {
  list: (
    opts: {
      limit?: number;
      offset?: number;
      unread?: boolean;
      days?: number;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set("limit", String(opts.limit));
    if (opts.offset) qs.set("offset", String(opts.offset));
    if (opts.unread) qs.set("unread", "1");
    if (opts.days) qs.set("days", String(opts.days));
    return requestWithAuth<{
      items: NotificationItem[];
      total: number;
      unread: number;
    }>(`/notifications?${qs.toString()}`);
  },

  unreadCount: () =>
    requestWithAuth<{ unread: number }>("/notifications/unread-count"),

  markRead: (id: string) =>
    requestWithAuth<{ message: string }>(`/notifications/read/${id}`, {
      method: "POST",
    }),

  markAllRead: () =>
    requestWithAuth<{ message: string }>("/notifications/read-all", {
      method: "POST",
    }),
};

// 举报类型（POST /reports 的 target_type 取值）
export type ReportTargetType = "idea" | "comment" | "user" | "agent";

// 社区治理：屏蔽 / 举报
export const modApi = {
  listBlocks: () =>
    requestWithAuth<{ users: User[]; total: number }>(`/user/blocks`),

  getBlockStatus: (userId: string) =>
    requestWithAuth<{
      blocked: boolean;
      blocked_by: boolean;
      can_interact: boolean;
    }>(`/users/${userId}/block`),

  blockUser: (userId: string) =>
    requestWithAuth<{ message: string }>(`/users/${userId}/block`, {
      method: "POST",
    }),

  unblockUser: (userId: string) =>
    requestWithAuth<{ message: string }>(`/users/${userId}/block`, {
      method: "DELETE",
    }),

  submitReport: (input: {
    target_type: ReportTargetType;
    target_id: string;
    reason: string;
    detail?: string;
  }) =>
    requestWithAuth<{ message: string }>(`/reports`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

// 通知偏好（服务端持久化）+ 推送设备 token
export const prefsApi = {
  get: () =>
    requestWithAuth<NotificationPreferences>(`/user/notification-preferences`),

  update: (data: Partial<NotificationPreferences>) =>
    requestWithAuth<NotificationPreferences>(`/user/notification-preferences`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  registerDevice: (input: { token: string; platform?: string }) =>
    requestWithAuth<UserDevice>(`/user/devices`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteDevice: (deviceId: string) =>
    requestWithAuth<{ message: string }>(`/user/devices/${deviceId}`, {
      method: "DELETE",
    }),
};

// 充值/会员模块
export const billingApi = {
  // 套餐与价格（公开）
  plans: () => request<PlansResponse>(`/billing/plans`),

  // 当前用户会员状态 + 今日额度 + Agent 用量
  membership: () => requestWithAuth<MembershipView>(`/billing/membership`),

  // 创建充值订单，返回支付地址（网页跳转 / 二维码 / mock）
  createOrder: (input: {
    plan_id: string;
    currency: string;
    gateway?: string;
  }) =>
    requestWithAuth<CreateOrderResult>(`/billing/orders`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // 订单列表
  listOrders: (limit = 20, offset = 0) =>
    requestWithAuth<{ orders: BillingOrder[]; total: number }>(
      `/billing/orders?limit=${limit}&offset=${offset}`,
    ),

  // 订单详情
  getOrder: (id: string) =>
    requestWithAuth<BillingOrder>(`/billing/orders/${id}`),

  // 取消未支付订单
  cancelOrder: (id: string) =>
    requestWithAuth<{ message: string }>(`/billing/orders/${id}/cancel`, {
      method: "POST",
    }),

  // 模拟支付成功（仅 mock 网关降级时可用，联调用）
  mockPay: (id: string) =>
    requestWithAuth<{ message: string }>(`/billing/orders/${id}/mock-pay`, {
      method: "POST",
    }),

  // 申请退款（对已支付订单，进入待审批）
  requestRefund: (orderId: string, reason: string) =>
    requestWithAuth<Refund>(`/billing/orders/${orderId}/refund`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // 我的退款申请列表
  listRefunds: (limit = 20, offset = 0) =>
    requestWithAuth<{ refunds: Refund[]; total: number }>(
      `/billing/refunds?limit=${limit}&offset=${offset}`,
    ),
};

// 管理员：退款审批
export const adminRefundApi = {
  // 待审批退款列表
  listPending: (limit = 20, offset = 0) =>
    requestWithAuth<{ refunds: Refund[]; total: number }>(
      `/admin/refunds?limit=${limit}&offset=${offset}`,
    ),

  // 批准退款（撤销会员）
  approve: (id: string, note?: string) =>
    requestWithAuth<{ message: string }>(`/admin/refunds/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note: note ?? "" }),
    }),

  // 拒绝退款
  reject: (id: string, note?: string) =>
    requestWithAuth<{ message: string }>(`/admin/refunds/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note: note ?? "" }),
    }),
};
