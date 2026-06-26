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
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";

export default function ChatPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const agentIdParam = searchParams.get("agent_id");
  const ideaIdParam = searchParams.get("idea_id");

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

  const updateLastAssistant = useCallback((content: string, contentType?: ChatMessageType["content_type"]) => {
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === "assistant") {
          updated[i] = {
            ...updated[i],
            content,
            ...(contentType ? { content_type: contentType } : {}),
          };
          return updated;
        }
      }
      updated.push({
        id: `temp-assistant-${Date.now()}`,
        session_id: activeId || "",
        role: "assistant",
        content_type: contentType ?? "markdown",
        content,
        created_at: new Date().toISOString(),
      });
      return updated;
    });
  }, [activeId]);

  useEffect(() => {
    if (!user) return;
    chatApi.listSessions().then((res) => setSessions(res.sessions));
  }, [user]);

  useEffect(() => {
    if (!user || !agentIdParam) return;

    const targetAgentId = agentIdParam;
    const targetIdeaId = ideaIdParam;
    let cancelled = false;

    async function openTargetChat() {
      setActiveId(null);
      setMessages([]);

      const res = await chatApi.listSessions();
      if (cancelled) return;
      setSessions(res.sessions);

      const existing = targetIdeaId
        ? res.sessions.find(
            (s) => s.idea_id === targetIdeaId && s.agent_id === targetAgentId
          )
        : res.sessions.find((s) => s.agent_id === targetAgentId && !s.idea_id);

      if (existing) {
        setActiveId(existing.id);
        return;
      }

      setCreatingSession(true);
      try {
        const created = await chatApi.createSession({
          agent_id: targetAgentId,
          idea_id: targetIdeaId || undefined,
        });
        if (cancelled) return;
        setSessions((prev) => {
          const deduped = prev.filter((s) => s.id !== created.session.id);
          return [created.session, ...deduped];
        });
        setActiveId(created.session.id);
      } catch (err) {
        notify.error(getErrorMessage(err, "创建对话失败"));
        setNewAgentId(targetAgentId);
        setShowNewDialog(true);
      } finally {
        if (!cancelled) setCreatingSession(false);
      }
    }

    void openTargetChat();
    return () => {
      cancelled = true;
    };
  }, [user, agentIdParam, ideaIdParam]);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await chatApi.getMessages(sessionId);
      setMessages(res.messages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      notify.error(getErrorMessage(err, "加载消息失败"));
    }
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    loadMessages(activeId).finally(() => setLoading(false));
  }, [activeId, loadMessages]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

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
    const assistantMsg: ChatMessageType = {
      id: `temp-assistant-${Date.now()}`,
      session_id: sessionId,
      role: "assistant",
      content_type: "markdown",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    let assistantContent = "";
    const stillActive = () => mountedRef.current && activeId === sessionId;

    const finishStream = async (finalContent?: string) => {
      if (!stillActive()) return;
      setStreaming(false);
      const contentToApply = finalContent ?? assistantContent;
      if (contentToApply) {
        updateLastAssistant(contentToApply);
      }
      try {
        const res = await chatApi.getMessages(sessionId);
        if (stillActive()) setMessages(res.messages);
        const sessionsRes = await chatApi.listSessions();
        if (stillActive()) setSessions(sessionsRes.sessions);
      } catch {
        /* keep optimistic messages */
      }
    };

    try {
      await chatApi.sendMessageStream(
        sessionId,
        content,
        (chunk) => {
          if (!stillActive()) return;
          assistantContent += chunk;
          updateLastAssistant(assistantContent);
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        },
        (fullContent) => {
          void finishStream(fullContent || assistantContent);
        },
        (err) => {
          if (!stillActive()) return;
          setStreaming(false);
          setMessages((prev) => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === "assistant" && !updated[i].content.trim()) {
                updated.splice(i, 1);
                break;
              }
            }
            updated.push({
              id: `error-${Date.now()}`,
              session_id: sessionId,
              role: "system",
              content: `⚠️ ${err.message}`,
              created_at: new Date().toISOString(),
            });
            return updated;
          });
        },
        (eventType, data) => {
          if (!stillActive()) return;
          const payload = data as {
            tool?: string;
            tool_call?: string;
            ok?: boolean;
            content?: string;
            content_type?: ChatMessageType["content_type"];
            target_agent_name?: string;
            target_agent_id?: string;
            task?: string;
            response_summary?: string;
          };
          if (eventType === "assistant_message" && payload.content) {
            assistantContent = payload.content;
            updateLastAssistant(payload.content, payload.content_type ?? "markdown");
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            return;
          }
          if (eventType === "tool_call") {
            const isDelegate = payload.tool === "delegate_to_agent";
            const displayText = isDelegate
              ? `🔗 正在与 ${payload.target_agent_name ?? "Agent"} 通信…`
              : `正在调用工具：${payload.tool ?? "unknown"}…`;
            setMessages((prev) => {
              const updated = [...prev];
              const toolMsg: ChatMessageType = {
                id: `tool-${payload.tool_call ?? Date.now()}`,
                session_id: sessionId,
                role: "system",
                content: displayText,
                metadata: {
                  type: "tool_call",
                  tool: payload.tool,
                  ...(isDelegate && {
                    is_a2a: true,
                    target_agent_name: payload.target_agent_name,
                    target_agent_id: payload.target_agent_id,
                    task: payload.task,
                  }),
                },
                created_at: new Date().toISOString(),
              };
              const assistantIdx = updated.findIndex((m) => m.id === assistantMsg.id);
              if (assistantIdx >= 0) updated.splice(assistantIdx, 0, toolMsg);
              else updated.push(toolMsg);
              return updated;
            });
          } else if (eventType === "tool_result") {
            const isDelegate = payload.tool === "delegate_to_agent";
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex(
                (m) =>
                  m.metadata?.type === "tool_call" &&
                  (m.metadata as { tool?: string }).tool === payload.tool
              );
              if (idx >= 0) {
                const resultText = isDelegate
                  ? `${payload.ok ? "✓" : "✗"} ${payload.target_agent_name ?? "Agent"} 回复：${payload.response_summary ?? ""}`
                  : `${payload.ok ? "✓" : "✗"} ${payload.tool} 完成`;
                updated[idx] = {
                  ...updated[idx],
                  content: resultText,
                  metadata: {
                    ...updated[idx].metadata,
                    ...(isDelegate && payload.ok && { a2a_completed: true }),
                  },
                };
              }
              return updated;
            });
          }
        }
      );
    } catch {
      if (stillActive()) void finishStream();
    }
  };

  const handleCreateSession = async () => {
    if (!newAgentId) return;
    setCreatingSession(true);
    try {
      const res = await chatApi.createSession({
        agent_id: newAgentId,
        idea_id: ideaIdParam || undefined,
        title: newTitle || undefined,
      });
      setSessions((prev) => [res.session, ...prev]);
      setActiveId(res.session.id);
      setMessages([]);
      setShowNewDialog(false);
      setNewAgentId("");
      setNewTitle("");
    } catch (err) {
      notify.error(getErrorMessage(err, "创建对话失败"));
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
      notify.error(getErrorMessage(err, "删除失败"));
    }
  };

  const handleMessageFeedback = useCallback(
    async (messageId: string, rating: "like" | "dislike" | null) => {
      if (!activeId) return;
      const prevFeedback = messages.find((m) => m.id === messageId)?.user_feedback;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, user_feedback: rating ?? undefined } : m
        )
      );
      try {
        if (rating === null) {
          await chatApi.clearMessageFeedback(activeId, messageId);
        } else {
          await chatApi.setMessageFeedback(activeId, messageId, rating);
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, user_feedback: prevFeedback } : m
          )
        );
        notify.error(getErrorMessage(err, "反馈失败"));
      }
    },
    [activeId, messages]
  );

  const handleForkFromMessage = useCallback(
    async (messageId: string) => {
      if (!activeId) return;
      try {
        const res = await chatApi.forkSession(activeId, {
          before_message_id: messageId,
        });
        setSessions((prev) => [res.session, ...prev]);
        setActiveId(res.session.id);
        notify.success("已创建分支对话");
      } catch (err) {
        notify.error(getErrorMessage(err, "分支失败"));
      }
    },
    [activeId]
  );

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
                      <ChatMessage
                        key={m.id}
                        message={m}
                        canFork={!!activeId}
                        onFeedback={handleMessageFeedback}
                        onFork={handleForkFromMessage}
                      />
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
