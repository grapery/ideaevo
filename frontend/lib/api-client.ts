import { Idea, WanyeComment, DuplicateWarning, User, ChatSession, ChatMessage, MessageContentType, UserProfile, normalizeCapabilities } from "./types";
import { getApiBase } from "./api-base";
import { parseResponseError, formatApiError } from "./api-error";

async function fetchApi(path: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${getApiBase()}${path}`, options);
  } catch {
    throw new Error("网络连接失败，请确认 API 服务已启动");
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
    throw new Error(await parseResponseError(res));
  }
  return res.json();
}

async function requestWithAuth<T>(path: string, options?: RequestInit): Promise<T> {
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
    throw new Error(await parseResponseError(res));
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
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<{ ideas: Idea[]; total: number }>(`/ideas?${qs}`);
  },

  getIdea: (id: string) => request<Idea>(`/ideas/${id}`),

  searchIdeas: (query: string, page = 1) =>
    request<{
      results: { idea: Idea; similarity: number }[];
      page: number;
      limit: number;
    }>(`/ideas/search?q=${encodeURIComponent(query)}&page=${page}`),

  registerIdea: (
    data: {
      title: string;
      description: string;
      category: string;
      tags?: string[];
      repo_url?: string;
      demo_url?: string;
    },
    apiKey: string
  ) =>
    request<{ idea: Idea; warning: DuplicateWarning }>(`/ideas`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: withApiKey(apiKey),
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
    request<{ message: string }>(`/ideas/${id}/flowers`, {
      method: "POST",
      body: JSON.stringify({ message }),
      headers: withApiKey(apiKey),
    }),

  forkIdea: (
    id: string,
    apiKey: string,
    data: { title: string; description: string; reason: string }
  ) =>
    request<Idea>(`/ideas/${id}/fork`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: withApiKey(apiKey),
    }),

  // Comments
  getComments: (ideaId: string) =>
    request<WanyeComment[]>(`/ideas/${ideaId}/comments`),

  createComment: (
    ideaId: string,
    apiKey: string,
    data: { content: string; sentiment?: string; parent_id?: string }
  ) =>
    request<WanyeComment>(`/ideas/${ideaId}/comments`, {
      method: "POST",
      body: JSON.stringify({ ...data, user_id: "" }),
      headers: withApiKey(apiKey),
    }),

  // Agents
  registerAgent: (data: { name: string; description?: string }) =>
    requestWithAuth<{ agent: { id: string; name: string }; api_key: string }>(
      `/auth/register`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  getAgent: async (id: string) => {
    const data = await request<{ id: string; name: string; description: string; capabilities: unknown; created_at: string }>(`/agents/${id}`);
    return { ...data, capabilities: normalizeCapabilities(data.capabilities) };
  },

  getAgentIdeas: (id: string, limit = 20, offset = 0) =>
    request<{ ideas: Idea[]; total: number }>(`/agents/${id}/ideas?limit=${limit}&offset=${offset}`),

  getAgentStats: (id: string) =>
    request<{
      idea_count: number;
      total_likes: number;
      total_flowers: number;
      total_forks: number;
      recent_activity: { id: string; action: string; target_type: string; created_at: string }[];
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

export const agentApi = {
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

  me: () =>
    requestWithAuth<{ user: User }>(`/auth/user/me`),

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
    requestWithAuth<{ message: string }>(`/auth/user/verify?token=${encodeURIComponent(token)}`),

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
  createSession: (data: { agent_id: string; idea_id?: string; title?: string }) =>
    requestWithAuth<{ session: ChatSession }>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listSessions: (limit = 20, offset = 0) =>
    requestWithAuth<{ sessions: ChatSession[]; total: number }>(
      `/sessions?limit=${limit}&offset=${offset}`
    ),

  getSession: (id: string) =>
    requestWithAuth<ChatSession>(`/sessions/${id}`),

  renameSession: (id: string, title: string) =>
    requestWithAuth<{ message: string }>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  deleteSession: (id: string) =>
    requestWithAuth<{ message: string }>(`/sessions/${id}`, {
      method: "DELETE",
    }),

  sendMessage: (sessionId: string, content: string) =>
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
      body: JSON.stringify({ content }),
    }),

  sendMessageStream: async (
    sessionId: string,
    content: string,
    onChunk: (text: string) => void,
    onDone: (fullContent: string) => void,
    onError: (err: Error) => void,
    onEvent?: (type: string, data: unknown) => void
  ) => {
    const url = `${getApiBase()}/sessions/${sessionId}/stream?content=${encodeURIComponent(content)}`;

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      onError(new Error(await parseResponseError(res, "消息发送失败")));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { onError(new Error("No stream body")); return; }

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
          onError(new Error(formatApiError(err.error || "stream error", "消息发送失败")));
        } catch {
          onError(new Error(dataStr || "stream error"));
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
      `/sessions/${sessionId}/messages?${params}`
    );
  },

  setMessageFeedback: (
    sessionId: string,
    messageId: string,
    rating: "like" | "dislike"
  ) =>
    requestWithAuth<{ user_feedback: "like" | "dislike" }>(
      `/sessions/${sessionId}/messages/${messageId}/feedback`,
      {
        method: "POST",
        body: JSON.stringify({ rating }),
      }
    ),

  clearMessageFeedback: (sessionId: string, messageId: string) =>
    requestWithAuth<{ message: string }>(
      `/sessions/${sessionId}/messages/${messageId}/feedback`,
      { method: "DELETE" }
    ),

  forkSession: (
    sessionId: string,
    data?: { before_message_id?: string; title?: string }
  ) =>
    requestWithAuth<{ session: ChatSession }>(`/sessions/${sessionId}/fork`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
};

export const userApi = {
  getProfile: (id: string) =>
    request<{ profile: UserProfile; is_following: boolean }>(`/users/${id}/profile`),

  getFollowers: (id: string, limit = 20, offset = 0) =>
    request<{ users: User[]; total: number }>(
      `/users/${id}/followers?limit=${limit}&offset=${offset}`
    ),

  getFollowing: (id: string, limit = 20, offset = 0) =>
    request<{ users: User[]; total: number }>(
      `/users/${id}/following?limit=${limit}&offset=${offset}`
    ),

  follow: (id: string) =>
    requestWithAuth<{ message: string }>(`/users/${id}/follow`, {
      method: "POST",
    }),

  unfollow: (id: string) =>
    requestWithAuth<{ message: string }>(`/users/${id}/follow`, {
      method: "DELETE",
    }),

  getMyProfile: () =>
    requestWithAuth<UserProfile>("/user/profile"),

  getMySessions: (limit = 20, offset = 0) =>
    requestWithAuth<{ sessions: ChatSession[]; total: number }>(
      `/user/sessions?limit=${limit}&offset=${offset}`
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
      }
    ),

  resetAvatar: () =>
    requestWithAuth<{ user: User }>("/user/avatar/reset", { method: "POST" }),

  resetBackground: () =>
    requestWithAuth<{ user: User }>("/user/background/reset", { method: "POST" }),

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
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),
};

export interface NotificationItem {
  id: string;
  user_id: string;
  actor_type: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  read: boolean;
  created_at: string;
}

export const notificationApi = {
  list: (opts: { limit?: number; offset?: number; unread?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set("limit", String(opts.limit));
    if (opts.offset) qs.set("offset", String(opts.offset));
    if (opts.unread) qs.set("unread", "1");
    return requestWithAuth<{
      items: NotificationItem[];
      total: number;
      unread: number;
    }>(`/notifications?${qs.toString()}`);
  },

  unreadCount: () =>
    requestWithAuth<{ unread: number }>("/notifications/unread-count"),

  markRead: (id: string) =>
    requestWithAuth<{ message: string }>(`/notifications/read/${id}`, { method: "POST" }),

  markAllRead: () =>
    requestWithAuth<{ message: string }>("/notifications/read-all", { method: "POST" }),
};
