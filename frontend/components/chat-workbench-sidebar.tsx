"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeimosIcon } from "@/components/deimos-icon";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import {
  ChatIdeaWritebackModal,
  ChatRelatedIdeas,
} from "@/components/chat-idea-writeback";
import { normalizeMessageMetadata } from "@/lib/chat-messages";
import type { ChatMessage, ChatSession, Idea } from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";

export type ChatToolTraceItem = {
  id: string;
  tool: string;
  at: string;
  ok?: boolean;
  isA2A?: boolean;
  targetAgentName?: string;
};

export function extractChatToolTrace(messages: ChatMessage[]): ChatToolTraceItem[] {
  const items: ChatToolTraceItem[] = [];
  for (const message of messages) {
    const meta = normalizeMessageMetadata(message.metadata);
    const activity = meta?.activity;
    if (!activity) continue;
    const tool = activity.tool || activity.tool_call || meta?.tool;
    if (!tool && !activity.is_a2a) continue;
    items.push({
      id: message.id,
      tool: tool || "a2a",
      at: message.created_at,
      ok: activity.ok,
      isA2A: activity.is_a2a,
      targetAgentName: activity.target_agent_name,
    });
  }
  return items;
}

function formatTraceTime(dateStr: string, locale: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function ChatWorkbenchSidebar({
  active,
  session,
  messages,
  agentName,
  ideaTitle,
  onSaveToIdea,
  onForkSession,
  onExportJson,
  onIdeaUpdated,
}: {
  active: boolean;
  session?: ChatSession | null;
  messages: ChatMessage[];
  agentName: string;
  ideaTitle?: string;
  onSaveToIdea: () => void;
  onForkSession: () => void;
  onExportJson: () => void;
  onIdeaUpdated?: (idea: Idea) => void;
}) {
  const { locale, t } = useI18n();
  const [writebackOpen, setWritebackOpen] = useState(false);
  const trace = useMemo(() => extractChatToolTrace(messages), [messages]);
  const messageCount = messages.filter((m) => m.role === "user" || m.role === "assistant").length;
  const ideaId = session?.idea_id;

  const relatedQuery = useMemo(() => {
    if (ideaTitle?.trim()) return ideaTitle.trim();
    const lastUser = [...messages].reverse().find((m) => m.role === "user" && m.content.trim());
    if (lastUser?.content) return lastUser.content.trim().slice(0, 120);
    return session?.title?.trim() || "";
  }, [ideaTitle, messages, session?.title]);

  return (
    <aside className="hidden w-[380px] shrink-0 border-l border-[var(--divider)] bg-[var(--bg-surface)] xl:flex xl:flex-col">
      <div className="flex h-[72px] shrink-0 items-center border-b border-[var(--divider)] px-5">
        <div>
          <p className="font-code text-[12px] font-semibold tracking-[0.06em] text-[var(--title)]">
            {t("chat.evidenceArtifact")}
          </p>
          <p className="mt-1 font-code text-xs text-[var(--text-muted)]">
            {active
              ? t("chat.toolCallsCount", { count: trace.length })
              : t("chat.waitingSession")}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <section className="rounded-[6px] border border-[var(--accent-success)]/35 bg-[var(--accent-success-soft)] p-4 font-code text-[12px] leading-7 text-[var(--accent-success)]">
          <p>{t("chat.currentVerdict")}</p>
          <p>{active ? t("chat.inProgress") : t("chat.waitingSession")}</p>
          <p>{t("chat.messagesCount", { count: messageCount })}</p>
        </section>

        <section>
          <div className="rounded-[6px] border border-[var(--rule)] bg-[var(--bg-canvas)] p-4">
            <p className="font-code text-[12px] text-[var(--title)]">{t("chat.currentExecutor")}</p>
            <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[var(--title)]">
              {active && session?.agent_id ? (
                <WireframeAvatar
                  name={agentName}
                  avatarUrl={session.agent?.avatar_url}
                  entityId={session.agent_id}
                  kind="agent"
                  size={28}
                  href={`/agents/${session.agent_id}`}
                />
              ) : (
                <DeimosIcon name="agent" className="h-4 w-4 text-[var(--accent-success)]" />
              )}
              {active && session?.agent_id ? (
                <Link
                  href={`/agents/${session.agent_id}`}
                  className="hover:text-[var(--accent-link)]"
                >
                  {agentName}
                </Link>
              ) : (
                t("chat.waitingSession")
              )}
            </p>
            <p className="mt-2 font-code text-xs text-[var(--text-muted)]">
              {t("chat.toolsConnected")}
            </p>
          </div>
        </section>

        <section>
          <div className="rounded-[6px] border border-[var(--rule)] bg-[var(--bg-canvas)] p-4 font-code text-[12px] leading-7 text-[var(--text-secondary)]">
            <p className="text-[var(--title)]">{t("chat.relatedContext")}</p>
            <p className="mt-3">
              {t("chat.boundIdea")} ·{" "}
              {ideaId ? (
                <Link href={`/ideas/${ideaId}`} className="text-[var(--accent-link)] hover:underline">
                  {ideaTitle || ideaId.slice(0, 8)}
                </Link>
              ) : (
                t("chat.noIdeaBound")
              )}
            </p>
            <p>{t("chat.toolCallsCount", { count: trace.length })}</p>
            <p>{t("chat.messagesCount", { count: messageCount })}</p>
            {ideaId && (
              <button
                type="button"
                onClick={() => setWritebackOpen(true)}
                className="mt-3 inline-flex items-center rounded border border-[var(--accent-link)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-link)] hover:bg-[var(--accent-link-soft)]"
              >
                {t("chat.writebackAction")}
              </button>
            )}
          </div>
        </section>

        {active && (
          <ChatRelatedIdeas query={relatedQuery} excludeIdeaId={ideaId} />
        )}

        <section>
          <div className="rounded-[6px] border border-[var(--rule)] bg-[var(--bg-canvas)] p-4 font-code text-[12px] leading-7 text-[var(--accent-link)]">
            <p className="text-[var(--title)]">{t("chat.toolTrace")}</p>
            {trace.length === 0 ? (
              <p className="mt-3 text-[var(--text-muted)]">{t("chat.noToolTrace")}</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {trace.slice(-12).map((item) => (
                  <p key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[var(--text-muted)]">
                      {formatTraceTime(item.at, locale)}
                    </span>
                    <span className="text-[var(--title)]">
                      {item.isA2A && item.targetAgentName
                        ? `A2A ${item.targetAgentName}`
                        : item.tool}
                    </span>
                    {item.ok === false && (
                      <span className="text-[var(--accent-warning)]">!</span>
                    )}
                  </p>
                ))}
              </div>
            )}
            <p className="mt-3 text-[var(--text-muted)]">{t("chat.replayable")}</p>
          </div>
        </section>
      </div>

      <div className="flex h-12 shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--divider)] px-4 font-code text-xs text-[var(--title)]">
        {ideaId && (
          <button
            type="button"
            onClick={() => setWritebackOpen(true)}
            disabled={!active}
            className="hover:text-[var(--accent-success)] disabled:opacity-40"
          >
            {t("chat.writebackAction")}
          </button>
        )}
        <button
          type="button"
          onClick={onSaveToIdea}
          disabled={!active}
          className="hover:text-[var(--accent-success)] disabled:opacity-40"
          title={t("chat.saveDraftHint")}
        >
          {ideaId ? t("chat.openBoundIdea") : t("chat.saveToIdea")}
        </button>
        <button
          type="button"
          onClick={onForkSession}
          disabled={!active}
          className="hover:text-[var(--accent-link)] disabled:opacity-40"
        >
          {t("chat.forkSession")}
        </button>
        <button
          type="button"
          onClick={onExportJson}
          disabled={!active}
          className="hover:text-[var(--accent-link)] disabled:opacity-40"
        >
          {t("chat.exportJson")}
        </button>
      </div>

      {ideaId && (
        <ChatIdeaWritebackModal
          open={writebackOpen}
          ideaId={ideaId}
          onClose={() => setWritebackOpen(false)}
          onSaved={onIdeaUpdated}
        />
      )}
    </aside>
  );
}
