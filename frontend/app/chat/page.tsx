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
import { Modal } from "@/components/ui/modal";
import {
  normalizeChatMessages,
  upsertChatMessage,
} from "@/lib/chat-messages";
import { DeimosIcon } from "@/components/deimos-icon";

function formatSessionTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${diffDays}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      setMessages(normalizeChatMessages(res.messages));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      notify.error(getErrorMessage(err, "加载消息失败"));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) {
      const timer = window.setTimeout(() => {
        if (!cancelled) setMessages([]);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      loadMessages(activeId).finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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
        if (stillActive()) {
          setMessages(normalizeChatMessages(res.messages));
        }
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
              content: `工具执行失败：${err.message}`,
              created_at: new Date().toISOString(),
            });
            return updated;
          });
        },
        (eventType, data) => {
          if (!stillActive()) return;
          const payload = data as {
            id?: string;
            tool?: string;
            tool_call?: string;
            ok?: boolean;
            content?: string;
            content_type?: ChatMessageType["content_type"];
            target_agent_name?: string;
            target_agent_id?: string;
            task?: string;
            response_summary?: string;
            session_id?: string;
            role?: ChatMessageType["role"];
            created_at?: string;
            metadata?: ChatMessageType["metadata"];
          };

          if (eventType === "user_message" && payload.id) {
            const messageId = payload.id;
            setMessages((prev) =>
              upsertChatMessage(prev, {
                id: messageId,
                session_id: sessionId,
                role: "user",
                content: payload.content ?? content,
                content_type: payload.content_type,
                created_at: payload.created_at ?? new Date().toISOString(),
              })
            );
            return;
          }

          if (eventType === "assistant_message" && payload.content) {
            assistantContent = payload.content;
            const assistant: ChatMessageType = {
              id: payload.id ?? assistantMsg.id,
              session_id: sessionId,
              role: "assistant",
              content: payload.content,
              content_type: payload.content_type ?? "markdown",
              created_at: payload.created_at ?? new Date().toISOString(),
            };
            setMessages((prev) => upsertChatMessage(prev, assistant));
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            return;
          }

          if (eventType === "tool_call") {
            const isDelegate = payload.tool === "delegate_to_agent";
            const displayText = isDelegate
              ? `🔗 正在与 ${payload.target_agent_name ?? "Agent"} 通信…`
              : `正在调用工具：${payload.tool ?? "unknown"}…`;
            const activityMsg: ChatMessageType = {
              id: payload.id ?? `tool-${payload.tool_call ?? Date.now()}`,
              session_id: sessionId,
              role: "system",
              content: displayText,
              metadata: {
                display_kind: "activity",
                activity: {
                  type: "tool_call",
                  tool: payload.tool,
                  tool_call: payload.tool_call,
                  ...(isDelegate && {
                    is_a2a: true,
                    target_agent_name: payload.target_agent_name,
                    target_agent_id: payload.target_agent_id,
                    task: payload.task,
                  }),
                },
              },
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => upsertChatMessage(prev, activityMsg));
            return;
          }

          if (eventType === "tool_result" && payload.id) {
            const isDelegate = payload.tool === "delegate_to_agent";
            const resultText = isDelegate
              ? `${payload.ok ? "✓" : "✗"} ${payload.target_agent_name ?? "Agent"} 回复：${payload.response_summary ?? ""}`
              : `${payload.ok ? "✓" : "✗"} ${payload.tool} 完成`;
            setMessages((prev) =>
              upsertChatMessage(prev, {
                id: payload.id!,
                session_id: sessionId,
                role: "system",
                content: resultText,
                metadata: {
                  display_kind: "activity",
                  activity: {
                    type: "tool_result",
                    tool: payload.tool,
                    tool_call: payload.tool_call,
                    ok: payload.ok,
                    ...(isDelegate && {
                      is_a2a: true,
                      target_agent_name: payload.target_agent_name,
                      a2a_completed: payload.ok,
                      response_summary: payload.response_summary,
                    }),
                  },
                },
                created_at: new Date().toISOString(),
              })
            );
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
      setPendingDeleteId(null);
      notify.success("会话已删除");
    } catch (err) {
      notify.error(getErrorMessage(err, "删除失败"));
    }
  };

  const handleArchiveSession = async (id: string) => {
    try {
      const res = await chatApi.archiveSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      const summary = res.result?.summary;
      notify.success(summary ? `已归档：${summary.slice(0, 40)}` : "会话已归档");
    } catch (err) {
      notify.error(getErrorMessage(err, "归档失败"));
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

  const workbenchTopbar = (
    <div className="flex h-12 shrink-0 items-center border-b border-[var(--divider)] bg-[var(--bg-surface)] px-[18px] font-code text-[10px]">
      <Link href="/ideas" className="font-semibold tracking-[0.04em] text-[var(--title)] hover:text-[var(--accent-link)]">
        DEIMOS / AGENT WORKBENCH
      </Link>
      <span className="ml-5 hidden items-center gap-2 text-[#9bff00] sm:inline-flex">
        <span className="h-2 w-2 rounded-full bg-current" />
        streaming connected
      </span>
      <span className="ml-5 hidden text-[#9bff00] lg:inline">model: qwen-plus</span>
      <span className="ml-5 hidden text-[#9bff00] lg:inline">tools: 8</span>
      <span className="ml-auto hidden text-[var(--text-muted)] md:inline">⌘K command&nbsp;&nbsp;&nbsp;&nbsp;⌘Enter send&nbsp;&nbsp;&nbsp;&nbsp;/ tools</span>
    </div>
  );

  if (!user) {
    return (
      <div className="chat-shell chat-workbench flex min-h-screen flex-col">
        {workbenchTopbar}
        <div className="flex flex-1 items-center justify-center bg-[var(--bg-canvas)] px-4 py-12">
          <div className="w-full max-w-[560px] overflow-hidden rounded-[8px] border border-[var(--rule)] bg-[var(--bg-surface)]">
            <div className="border-b border-[var(--rule)] px-6 py-5">
              <p className="font-code text-[10px] tracking-[0.14em] text-[#9bff00]">
                AUTHORIZATION REQUIRED / HUMAN OWNER
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--accent-link)] bg-[var(--accent-link-soft)] text-[var(--accent-link)]">
                <DeimosIcon name="agent" className="h-6 w-6" />
              </div>
              <h2 className="font-display text-xl font-semibold text-[var(--title)]">登录后进入 Agent 工作台</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                对话不只是问答。Agent 会搜索已有想法、调用 MCP 工具、记录证据并持续跟踪实现状态。
              </p>
              <div className="my-6 grid gap-2 sm:grid-cols-3">
                {[
                  ["semantic-search", "语义去重"],
                  ["tool", "MCP 执行"],
                  ["lifecycle", "状态跟踪"],
                ].map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-2 rounded-md border border-[var(--rule)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--ink-soft)]">
                    <DeimosIcon
                      name={icon as "semantic-search" | "tool" | "lifecycle"}
                      className="h-3.5 w-3.5 text-[var(--accent-link)]"
                    />
                    {label}
                  </div>
                ))}
              </div>
              <Link href="/login?returnUrl=/chat" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-[var(--accent-link)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-link-hover)]">
                登录并开始对话
                <DeimosIcon name="chevron-right" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const agentName = activeSession?.agent?.name || activeSession?.agent_id?.slice(0, 8) || "Agent";
  const ideaTitle = activeSession?.idea?.title;

  return (
    <div className="chat-shell chat-workbench flex h-dvh min-h-[640px] flex-col">
      {workbenchTopbar}
      <div className="flex min-h-0 flex-1">
        {/* Session column */}
        <div className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-[268px] shrink-0 border-r border-[var(--divider)] bg-[var(--bg-surface)] flex-col`}>
          <div className="border-b border-[var(--divider)] p-3">
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="flex h-10 w-full items-center rounded-[6px] bg-[#f5f5f7] px-3 text-left text-[12px] font-semibold text-[#111113] hover:bg-white"
            >
              + New investigation
            </button>
            <p className="mt-3 font-code text-[9px] tracking-[0.08em] text-[var(--text-muted)]">RECENT SESSIONS</p>
          </div>
          {sessions.length > 5 && (
          <div className="border-b border-[var(--divider)] px-3 py-2">
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
          )}
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center mt-8 px-4">
                还没有对话，点击「+ 新对话」开始
              </p>
            )}
            {filteredSessions.map((s) => {
              const agentName = s.agent?.name || s.agent_id?.slice(0, 8) || "Agent";
              return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectSession(s.id)}
                onKeyDown={(e) => e.key === "Enter" && handleSelectSession(s.id)}
                className={`px-4 py-3 flex items-start gap-3 cursor-pointer border-b border-[var(--divider)] hover:bg-[var(--bg-subtle)] transition-colors ${
                  activeId === s.id ? "bg-[var(--accent-link-soft)] shadow-[inset_2px_0_0_var(--accent-link)]" : ""
                }`}
              >
                <div className="h-9 w-9 shrink-0 rounded-md bg-[var(--primary-soft)] flex items-center justify-center text-sm font-medium text-[var(--accent-link)] overflow-hidden border border-[var(--rule)]">
                  {s.agent?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.agent.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>{agentName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--title)] truncate">{s.title}</span>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">
                      {formatSessionTime(s.updated_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {agentName} · {s.message_count} 条消息
                    </p>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleArchiveSession(s.id);
                        }}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--ink)]"
                      >
                        归档
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(s.id);
                        }}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--coral)]"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Chat column */}
        <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-[var(--bg-canvas)] min-w-0`}>
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center px-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--accent-link)]">
                  <DeimosIcon name="agent" className="h-6 w-6" />
                </div>
                <h1 className="text-lg font-semibold text-[var(--title)]">把想法交给 Agent 推进</h1>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  搜索、去重、评估并调用 MCP 工具，把一次聊天沉淀成可跟踪的想法与证据。
                </p>
                <button type="button" onClick={() => setShowNewDialog(true)} className="mt-5 btn-primary btn-sm">
                  <DeimosIcon name="chat" className="h-3.5 w-3.5" />创建任务会话
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex h-[70px] shrink-0 items-center gap-3 border-b border-[var(--divider)] bg-[#0a0a0b] px-6">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--rule)] text-[var(--text-muted)] hover:text-[var(--title)] md:hidden"
                  aria-label="返回会话列表"
                >
                  <DeimosIcon name="back" className="h-4 w-4" />
                </button>
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--rule)] bg-[var(--primary-soft)] text-xs font-semibold text-[var(--accent-link)]">
                  {agentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--title)]">{activeSession?.title || agentName}</p>
                  {ideaTitle && (
                    <p className="text-xs text-[var(--accent-link)] truncate">想法上下文：{ideaTitle}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 font-code text-[9px] font-medium text-[#9bff00]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />可执行
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-10">
                <div className="mx-auto max-w-[820px]">
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
                        <div className="inline-flex items-center gap-2 rounded-md border border-[var(--rule)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-link)]" />
                          Agent 正在规划下一步…
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
                </div>
              </div>

              <ChatInput onSend={handleSend} disabled={streaming} />
            </>
          )}
        </div>

        <aside className="hidden w-[392px] shrink-0 border-l border-[var(--divider)] bg-[var(--bg-surface)] xl:flex xl:flex-col">
          <div className="flex h-[70px] shrink-0 items-center border-b border-[var(--divider)] px-4">
            <div>
              <p className="font-code text-[10px] font-semibold tracking-[0.08em] text-[var(--title)]">EVIDENCE ARTIFACT</p>
              <p className="mt-1 font-code text-[9px] text-[var(--text-muted)]">implementation-check.json</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <section className="rounded-[6px] border border-[#3b6e00] bg-[#132316] p-3 font-code text-[11px] leading-6 text-[#9bff00]">
              <p>CURRENT VERDICT</p>
              <p>{activeId ? "IN PROGRESS" : "WAITING FOR SESSION"}</p>
              <p>confidence: {activeId ? "0.78" : "—"}</p>
            </section>
            <section>
              <div className="rounded-[6px] border border-[var(--rule)] bg-[#0a0a0b] p-3">
                <p className="font-code text-[10px] text-[var(--title)]">CURRENT EXECUTOR</p>
                <p className="mt-3 flex items-center gap-2 text-[12px] font-medium text-[var(--title)]">
                  <DeimosIcon name="agent" className="h-4 w-4 text-[#36d399]" />
                  {activeId ? agentName : "等待选择 Agent"}
                </p>
                <p className="mt-2 font-code text-[9px] text-[var(--text-muted)]">MCP + A2A tools connected</p>
              </div>
            </section>
            <section>
              <div className="rounded-[6px] border border-[var(--rule)] bg-[#0a0a0b] p-3 font-code text-[10px] leading-6 text-[var(--text-secondary)]">
                <p className="text-[var(--title)]">CANDIDATES / CONTEXT</p>
                <p className="mt-3">01&nbsp;&nbsp;{ideaTitle || "No idea bound"}</p>
                <p>02&nbsp;&nbsp;semantic duplicate check</p>
                <p>03&nbsp;&nbsp;implementation evidence</p>
              </div>
            </section>
            <section>
              <div className="rounded-[6px] border border-[var(--rule)] bg-[#0a0a0b] p-3 font-code text-[10px] leading-6 text-[#8dc0ff]">
                <p className="text-[var(--title)]">PROVENANCE</p>
                <p className="mt-3">09:42:18 search_ideas</p>
                <p>09:42:19 get_idea</p>
                <p>09:42:22 A2A repo-inspector</p>
                <p>09:42:26 web evidence attached</p>
                <p>09:42:30 verdict updated</p>
                <p className="mt-3">Every step is replayable.</p>
              </div>
            </section>
          </div>
          <div className="flex h-12 shrink-0 items-center gap-6 border-t border-[var(--divider)] px-4 font-code text-[9px] text-[var(--title)]">
            <button type="button" className="hover:text-[#9bff00]">SAVE TO IDEA</button>
            <button type="button" className="hover:text-[var(--accent-link)]">FORK SESSION</button>
            <button type="button" className="hover:text-[var(--accent-link)]">EXPORT JSON</button>
          </div>
        </aside>
      </div>

      <Modal
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title="删除任务会话"
        description="消息、工具运行记录与分支上下文将一并删除，此操作无法撤销。"
        className="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setPendingDeleteId(null)} className="btn-default btn-sm">
            取消
          </button>
          <button
            type="button"
            onClick={() => pendingDeleteId && void handleDeleteSession(pendingDeleteId)}
            className="btn-sm rounded border border-[var(--accent-warning)] bg-[var(--accent-warning)] px-3 text-white hover:opacity-90"
          >
            确认删除
          </button>
        </div>
      </Modal>

      {showNewDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="rounded-md border border-[var(--rule)] bg-[var(--bg-surface)] p-6 w-full max-w-md shadow-2xl">
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
                  className="btn-default btn-sm"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={!newAgentId || creatingSession}
                  className="btn-outline px-4 py-2 text-sm disabled:opacity-40"
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
