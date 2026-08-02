"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { chatApi } from "@/lib/api-client";
import { ChatSession, ChatMessage as ChatMessageType, ChatAttachmentRef } from "@/lib/types";
import ChatMessage from "@/components/chat-message";
import ChatInput from "@/components/chat-input";
import { ChatWorkbenchSidebar } from "@/components/chat-workbench-sidebar";
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
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale, TranslationKey } from "@/lib/i18n/messages";

function formatSessionTime(
  dateStr: string,
  locale: Locale,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return t("common.dayAgo", { count: diffDays });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ChatPage() {
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
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

  // 滚动到消息列表底部。用 requestAnimationFrame + 双重 rAF 确保 DOM 更新后再滚动，
  // 解决 React 批量更新导致 scrollIntoView 在渲染前执行、看不到新内容的问题。
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    });
  }, []);

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
        notify.error(getErrorMessage(err, t("common.operationFailed")));
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
  }, [user, agentIdParam, ideaIdParam, t]);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await chatApi.getMessages(sessionId);
      setMessages(normalizeChatMessages(res.messages));
      setTimeout(() => scrollToBottom(), 50);
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.loadFailed")));
    }
  }, [t]);

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

  const handleSend = async (content: string, attachment?: ChatAttachmentRef) => {
    if (!activeId) return;
    const sessionId = activeId;
    const userMsg: ChatMessageType = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
      ...(attachment && {
        metadata: {
          attachment: {
            id: attachment.id,
            kind: attachment.kind,
            file_name: attachment.file_name,
            summary: attachment.summary,
            url: attachment.url,
            size: attachment.size,
          },
        },
      }),
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
    scrollToBottom();

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
          scrollToBottom();
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
          scrollToBottom();
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
              content: t("chat.toolFailed", { msg: err.message }),
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
            scrollToBottom();
            return;
          }

          if (eventType === "tool_call") {
            const isDelegate = payload.tool === "delegate_to_agent";
            const displayText = isDelegate
              ? t("chat.communicatingWith", { name: payload.target_agent_name ?? "Agent" })
              : t("chat.callingTool", { tool: payload.tool ?? "unknown" });
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
              ? `${payload.ok ? "✓" : "✗"} ${t("chat.agentReplied", { name: payload.target_agent_name ?? "Agent", summary: payload.response_summary ?? "" })}`
              : `${payload.ok ? "✓" : "✗"} ${t("chat.toolDone", { tool: payload.tool ?? "unknown" })}`;
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
        },
        attachment?.id,
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
      notify.error(getErrorMessage(err, t("common.operationFailed")));
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
      notify.success(t("chat.delete"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
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
      notify.success(summary ? `${t("chat.archive")}：${summary.slice(0, 40)}` : t("chat.archive"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
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
        notify.error(getErrorMessage(err, t("common.operationFailed")));
      }
    },
    [activeId, messages, t]
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
        notify.success(t("chat.sessionForked"));
      } catch (err) {
        notify.error(getErrorMessage(err, t("common.operationFailed")));
      }
    },
    [activeId, t]
  );

  const handleForkSession = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await chatApi.forkSession(activeId);
      setSessions((prev) => [res.session, ...prev]);
      setActiveId(res.session.id);
      notify.success(t("chat.sessionForked"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    }
  }, [activeId, t]);

  const handleExportSession = useCallback(() => {
    if (!activeId || !activeSession) return;
    const payload = {
      session: activeSession,
      messages,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deimos-session-${activeId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(t("chat.exported"));
  }, [activeId, activeSession, messages, t]);

  const handleSaveToIdea = useCallback(() => {
    if (!activeSession) return;
    if (activeSession.idea_id) {
      router.push(`/ideas/${activeSession.idea_id}`);
      return;
    }
    const dialogue = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.content.trim()}`)
      .filter((line) => line.length > 8)
      .join("\n\n");
    const draftTitle =
      activeSession.title ||
      activeSession.agent?.name ||
      activeSession.agent_id?.slice(0, 8) ||
      "Agent";
    const draft = {
      title: draftTitle,
      description: dialogue.slice(0, 4000),
      agent_id: activeSession.agent_id,
      from_session_id: activeSession.id,
    };
    try {
      sessionStorage.setItem("deimos_idea_draft_from_chat", JSON.stringify(draft));
    } catch {
      // ignore quota / private mode
    }
    notify.success(t("chat.saveDraftHint"));
    router.push("/ideas/new?from=chat");
  }, [activeSession, messages, router, t]);

  const workbenchTopbar = (
    <div className="flex h-12 shrink-0 items-center border-b border-[var(--divider)] bg-[var(--bg-surface)] px-[18px] font-code text-xs">
      <Link href="/ideas" className="font-semibold tracking-[0.04em] text-[var(--title)] hover:text-[var(--accent-link)]">
        {t("chat.workbench")}
      </Link>
      <span className="ml-5 hidden items-center gap-2 text-[var(--accent-success)] sm:inline-flex">
        <span className="h-2 w-2 rounded-full bg-current" />
        {t("chat.streamingConnected")}
      </span>
      <span className="ml-5 hidden text-[var(--accent-success)] lg:inline">{t("chat.model")}: qwen-plus</span>
      <span className="ml-5 hidden text-[var(--accent-success)] lg:inline">{t("chat.tools")}: 8</span>
      <span className="ml-auto hidden text-[var(--text-muted)] md:inline">{t("chat.commandHints")}</span>
      <div className="ml-4">
        <LanguageSwitcher dark />
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="chat-shell chat-workbench flex min-h-screen flex-col">
        {workbenchTopbar}
        <div className="flex flex-1 items-center justify-center bg-[var(--bg-canvas)] px-4 py-12">
          <div className="w-full max-w-[560px] overflow-hidden rounded-[8px] border border-[var(--rule)] bg-[var(--bg-surface)]">
            <div className="border-b border-[var(--rule)] px-6 py-5">
              <p className="font-code text-xs tracking-[0.12em] text-[var(--accent-success)]">
                {t("chat.authRequired")}
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--accent-link)] bg-[var(--accent-link-soft)] text-[var(--accent-link)]">
                <DeimosIcon name="agent" className="h-6 w-6" />
              </div>
              <h2 className="font-display text-xl font-semibold text-[var(--title)]">{t("chat.loginWorkbench")}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                {t("chat.authDescription")}
              </p>
              <div className="my-6 grid gap-2 sm:grid-cols-3">
                {[
                  ["semantic-search", t("chat.semanticDedup")],
                  ["tool", t("chat.mcpExecution")],
                  ["lifecycle", t("chat.statusTracking")],
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
                {t("chat.loginStart")}
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
        <div className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-[288px] shrink-0 border-r border-[var(--divider)] bg-[var(--bg-surface)] flex-col`}>
          <div className="border-b border-[var(--divider)] p-3">
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="flex h-11 w-full items-center rounded-[6px] border border-[var(--primary)] bg-[var(--primary)] px-3.5 text-left text-[13px] font-semibold text-white hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)]"
            >
              + {t("chat.newChat")}
            </button>
            <p className="mt-3 font-code text-xs tracking-[0.08em] text-[var(--text-muted)]">{t("chat.recentSessions")}</p>
          </div>
          {sessions.length > 5 && (
          <div className="border-b border-[var(--divider)] px-3 py-2">
            <SearchInput
              variant="pill"
              className="w-full"
              id="session-search"
              placeholder={t("chat.searchSessions")}
              value={sessionSearch}
              onChange={setSessionSearch}
              navigateOnSubmit={false}
            />
          </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center mt-8 px-4">
                {t("chat.noSessions")}
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
                <WireframeAvatar
                  name={agentName}
                  avatarUrl={s.agent?.avatar_url}
                  entityId={s.agent_id}
                  kind="agent"
                  size={36}
                  href={s.agent_id ? `/agents/${s.agent_id}` : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--title)] truncate">{s.title}</span>
                    <span className="text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
                      {formatSessionTime(s.updated_at, locale, t)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-[13px] text-[var(--text-muted)] truncate">
                      {agentName} · {t("chat.messageCount", { count: s.message_count })}
                    </p>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleArchiveSession(s.id);
                        }}
                        className="text-[12px] text-[var(--text-muted)] hover:text-[var(--ink)]"
                      >
                        {t("chat.archive")}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(s.id);
                        }}
                        className="text-[12px] text-[var(--text-muted)] hover:text-[var(--coral)]"
                      >
                        {t("chat.delete")}
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
                <h1 className="text-lg font-semibold text-[var(--title)]">{t("chat.selectTitle")}</h1>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {t("chat.selectHint")}
                </p>
                <button type="button" onClick={() => setShowNewDialog(true)} className="mt-5 btn-primary btn-sm">
                  <DeimosIcon name="chat" className="h-3.5 w-3.5" />{t("chat.createTask")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[var(--divider)] bg-[var(--bg-surface)] px-6">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--rule)] text-[var(--text-muted)] hover:text-[var(--title)] md:hidden"
                  aria-label={t("chat.back")}
                >
                  <DeimosIcon name="back" className="h-4 w-4" />
                </button>
                <WireframeAvatar
                  name={agentName}
                  avatarUrl={activeSession?.agent?.avatar_url}
                  entityId={activeSession?.agent_id}
                  kind="agent"
                  size={38}
                  href={
                    activeSession?.agent_id
                      ? `/agents/${activeSession.agent_id}`
                      : undefined
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[var(--title)]">{activeSession?.title || agentName}</p>
                  {ideaTitle && (
                    <p className="text-[13px] text-[var(--accent-link)] truncate">{t("chat.ideaContext")}: {ideaTitle}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 font-code text-xs font-medium text-[var(--accent-success)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />{t("chat.executable")}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-7 lg:px-10">
                <div className="mx-auto max-w-[880px]">
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
                        userIdentity={user ? {
                          id: user.id,
                          name: user.name,
                          avatarUrl: user.avatar_url,
                        } : undefined}
                        agentIdentity={{
                          id: activeSession?.agent_id,
                          name: agentName,
                          avatarUrl: activeSession?.agent?.avatar_url,
                        }}
                        canFork={!!activeId}
                        onFeedback={handleMessageFeedback}
                        onFork={handleForkFromMessage}
                      />
                    ))}
                    {streaming && (
                      <div className="flex justify-start mb-4">
                        <div className="inline-flex items-center gap-2 rounded-md border border-[var(--rule)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-link)]" />
                          {t("chat.agentPlanning")}
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

        <ChatWorkbenchSidebar
          active={!!activeId}
          session={activeSession}
          messages={messages}
          agentName={agentName}
          ideaTitle={ideaTitle}
          onSaveToIdea={handleSaveToIdea}
          onForkSession={() => void handleForkSession()}
          onExportJson={handleExportSession}
          onIdeaUpdated={(idea) => {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeId && s.idea_id === idea.id
                  ? { ...s, idea: { ...s.idea, ...idea, id: idea.id } }
                  : s,
              ),
            );
          }}
        />
      </div>

      <Modal
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title={t("chat.createTask")}
        description={t("chat.deleteTaskDesc")}
        className="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setPendingDeleteId(null)} className="btn-default btn-sm">
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => pendingDeleteId && void handleDeleteSession(pendingDeleteId)}
            className="btn-sm rounded border border-[var(--accent-warning)] bg-[var(--accent-warning)] px-3 text-white hover:opacity-90"
          >
            {t("common.confirm")}
          </button>
        </div>
      </Modal>

      {showNewDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="rounded-md border border-[var(--rule)] bg-[var(--bg-surface)] p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--title)] mb-4">
              {t("chat.newChat")}
            </h3>
            <div className="space-y-4">
              <FormField id="new-agent-id" label={t("chat.agentId")}>
                <Input
                  name="agent-id"
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  placeholder={t("chat.agentIdPlaceholder")}
                />
              </FormField>
              <FormField id="new-chat-title" label={t("chat.optionalTitle")}>
                <Input
                  name="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t("chat.titlePlaceholder")}
                />
              </FormField>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewDialog(false)}
                  className="btn-default btn-sm"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={!newAgentId || creatingSession}
                  className="btn-outline px-4 py-2 text-sm disabled:opacity-40"
                >
                  {creatingSession
                    ? t("common.loading")
                    : t("chat.create")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
