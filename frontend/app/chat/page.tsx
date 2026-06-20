"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { chatApi } from "@/lib/api-client";
import { ChatSession, ChatMessage as ChatMessageType } from "@/lib/types";
import ChatMessage from "@/components/chat-message";
import ChatInput from "@/components/chat-input";
import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-error";

export default function ChatPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    chatApi.listSessions().then((res) => {
      setSessions(res.sessions);
      const agentId = searchParams.get("agent_id");
      const ideaId = searchParams.get("idea_id");
      if (agentId && res.sessions.length === 0) {
        setNewAgentId(agentId);
        setShowNewDialog(true);
      } else if (ideaId && agentId) {
        const existing = res.sessions.find((s) => s.idea_id === ideaId);
        if (existing) setActiveId(existing.id);
      }
    });
  }, [user, searchParams]);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await chatApi.getMessages(sessionId);
      setMessages(res.messages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(getErrorMessage(err, "加载消息失败"));
    }
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveId(id);
      setLoading(true);
      loadMessages(id).finally(() => setLoading(false));
    },
    [loadMessages]
  );

  const handleSend = async (content: string) => {
    if (!activeId) return;
    const sessionId = activeId;
    const userMsg: ChatMessageType = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    let assistantContent = "";
    const assistantMsg: ChatMessageType = {
      id: `temp-assistant-${Date.now()}`,
      session_id: sessionId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    // Guard: ignore stream updates if the active session changed or component unmounted.
    const stillActive = () => mountedRef.current && activeId === sessionId;

    try {
      await chatApi.sendMessageStream(
        sessionId,
        content,
        (chunk) => {
          if (!stillActive()) return;
          assistantContent += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: assistantContent,
            };
            return updated;
          });
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        },
        () => {
          if (!stillActive()) return;
          setStreaming(false);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? { ...s, message_count: s.message_count + 2, updated_at: new Date().toISOString() }
                : s
            )
          );
        },
        (err) => {
          if (!stillActive()) return;
          setStreaming(false);
          // 错误时把临时 assistant 消息替换为错误提示
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              role: "system",
              content: `⚠️ ${err.message}`,
            };
            return updated;
          });
        },
        // 新增：监听工具调用进度事件，插入到 assistant 消息之前
        (eventType, data) => {
          if (!stillActive()) return;
          const payload = data as { tool?: string; tool_call?: string; ok?: boolean };
          if (eventType === "tool_call") {
            setMessages((prev) => {
              const updated = [...prev];
              const toolMsg: ChatMessageType = {
                id: `tool-${payload.tool_call ?? Date.now()}`,
                session_id: sessionId,
                role: "system",
                content: `正在调用工具：${payload.tool ?? "unknown"}…`,
                metadata: { type: "tool_call", tool: payload.tool },
                created_at: new Date().toISOString(),
              };
              updated.splice(updated.length - 1, 0, toolMsg);
              return updated;
            });
          } else if (eventType === "tool_result") {
            setMessages((prev) => {
              const updated = [...prev];
              // 找到对应的 tool_call 消息并更新为完成态
              const idx = updated.findIndex(
                (m) =>
                  m.metadata?.type === "tool_call" &&
                  (m.metadata as { tool?: string }).tool === payload.tool
              );
              if (idx >= 0) {
                updated[idx] = {
                  ...updated[idx],
                  content: `${payload.ok ? "✓" : "✗"} ${payload.tool} 完成`,
                };
              }
              return updated;
            });
          }
        }
      );
    } catch {
      if (stillActive()) setStreaming(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newAgentId) return;
    setCreatingSession(true);
    try {
      const res = await chatApi.createSession({
        agent_id: newAgentId,
        idea_id: searchParams.get("idea_id") || undefined,
        title: newTitle || undefined,
      });
      setSessions((prev) => [res.session, ...prev]);
      setActiveId(res.session.id);
      setMessages([]);
      setShowNewDialog(false);
      setNewAgentId("");
      setNewTitle("");
    } catch (err) {
      toast.error(getErrorMessage(err, "创建对话失败"));
    } finally {
      setCreatingSession(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await chatApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "删除失败"));
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="surface-card p-10 text-center max-w-md">
          <h2 className="text-xl font-semibold text-[var(--title)] mb-2">请先登录</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">登录后即可与 Agent 对话</p>
          <Link href="/login" className="inline-block gradient-btn px-6 py-2.5 text-sm font-medium">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  const agentName = activeSession?.agent?.name || activeSession?.agent_id?.slice(0, 8) || "Agent";
  const ideaTitle = activeSession?.idea?.title;

  return (
    <div className="h-[calc(100vh-64px)] bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container h-full flex">
        {/* Session column */}
        <div className="w-[300px] shrink-0 border-r border-[var(--divider)] bg-[var(--bg-surface)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--divider)]">
            <h2 className="text-base font-semibold text-[var(--title)]">对话</h2>
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              + 新对话
            </button>
          </div>
          <div className="px-4 py-3">
            <SearchInput
              variant="pill"
              className="w-full"
              id="session-search"
              placeholder="搜索对话…"
              value={sessionSearch}
              onChange={setSessionSearch}
              navigateOnSubmit={false}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center mt-8 px-4">
                还没有对话，点击「+ 新对话」开始
              </p>
            )}
            {filteredSessions.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectSession(s.id)}
                onKeyDown={(e) => e.key === "Enter" && handleSelectSession(s.id)}
                className={`px-4 py-3 cursor-pointer border-b border-[var(--divider)] hover:bg-[var(--bg-subtle)] transition-colors ${
                  activeId === s.id ? "bg-[var(--primary-soft)]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--title)] truncate">{s.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--coral)] shrink-0"
                  >
                    删除
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                  {s.agent?.name || s.agent_id?.slice(0, 8)} · {s.message_count} 条消息
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Chat column */}
        <div className="flex-1 flex flex-col bg-[var(--bg-surface)] min-w-0">
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
              <p>选择或创建一个对话开始聊天</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--divider)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                  {agentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--title)]">{agentName} · 在线</p>
                  {ideaTitle && (
                    <p className="text-xs text-[var(--primary)] truncate">绑定: {ideaTitle}</p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <ChatMessage key={m.id} message={m} />
                    ))}
                    {streaming && (
                      <div className="flex justify-start mb-4">
                        <div className="rounded-2xl bg-[var(--bg-subtle)] px-4 py-2.5 text-sm text-[var(--text-muted)]">
                          正在思考…
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <ChatInput onSend={handleSend} disabled={streaming} />
            </>
          )}
        </div>
      </div>

      {showNewDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="surface-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--title)] mb-4">新建对话</h3>
            <div className="space-y-4">
              <FormField id="new-agent-id" label="Agent ID">
                <Input
                  name="agent-id"
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  placeholder="输入或粘贴 Agent ID"
                />
              </FormField>
              <FormField id="new-chat-title" label="标题（可选）">
                <Input
                  name="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="给对话起个名字"
                />
              </FormField>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewDialog(false)}
                  className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm hover:bg-[var(--bg-subtle)]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={!newAgentId || creatingSession}
                  className="gradient-btn px-4 py-2 text-sm disabled:opacity-40"
                >
                  {creatingSession ? "创建中…" : "创建"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
