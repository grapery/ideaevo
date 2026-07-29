"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notify } from "@/components/ui/notify";
import {
  ChatMessage as ChatMessageType,
  ChatMessageMetadata,
  MessageContentType,
} from "@/lib/types";
import { normalizeMessageMetadata } from "@/lib/chat-messages";
import { IconGitFork } from "./icons";
import { DeimosIcon } from "./deimos-icon";
import { WireframeAvatar } from "./wireframe-avatar";
import { useI18n } from "@/lib/i18n/provider";

type ChatIdentity = {
  id?: string;
  name: string;
  avatarUrl?: string;
};

function resolveContentType(message: ChatMessageType): MessageContentType {
  if (message.content_type) return message.content_type;
  if (message.role === "assistant") return "markdown";
  return "text";
}

function resolveActivityMeta(metadata?: ChatMessageMetadata | string) {
  const meta = normalizeMessageMetadata(metadata);
  const activity = meta?.activity;
  if (activity) return activity;
  // legacy SSE-only metadata
  if (meta?.type === "tool_call" || meta?.tool) {
    return {
      type: meta.type === "tool_call" ? ("tool_call" as const) : undefined,
      tool: meta.tool,
      is_a2a: meta.is_a2a,
      target_agent_name: meta.target_agent_name,
      target_agent_id: meta.target_agent_id,
      task: meta.task,
      a2a_completed: meta.a2a_completed,
    };
  }
  return undefined;
}

function isActivityMessage(message: ChatMessageType): boolean {
  const meta = normalizeMessageMetadata(
    message.metadata as ChatMessageMetadata | string | undefined,
  );
  return (
    message.role === "system" &&
    (meta?.display_kind === "activity" ||
      meta?.activity != null ||
      meta?.type === "tool_call")
  );
}

function isPersistedMessage(id: string): boolean {
  return id.length > 0 && !id.startsWith("temp-") && !id.startsWith("error-");
}

function JsonBlock({ content }: { content: string }) {
  let formatted = content;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // keep raw string
  }
  return (
    <pre className="overflow-x-auto rounded-lg bg-[var(--bg-canvas)] p-3 text-[13px] leading-6 font-mono">
      <code>{formatted}</code>
    </pre>
  );
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-2 mt-4 text-lg font-semibold leading-7 text-[var(--title)] first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-4 text-[17px] font-semibold leading-7 text-[var(--title)] first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 mt-3 text-[15px] font-semibold leading-6 text-[var(--title)] first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-[var(--title)]">
            {children}
          </strong>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-[var(--primary)] underline underline-offset-2 hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-lg bg-[var(--bg-canvas)] p-3 text-[13px] leading-6 font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-[var(--bg-canvas)] px-1.5 py-0.5 text-[0.88em] font-mono text-[var(--title)]">
              {children}
            </code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-[var(--border)] pl-3 text-[var(--text-secondary)] last:mb-0">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function MessageBody({
  content,
  contentType,
  isUser,
}: {
  content: string;
  contentType: MessageContentType;
  isUser: boolean;
}) {
  if (contentType === "json") {
    return <JsonBlock content={content} />;
  }
  if (contentType === "markdown" && !isUser) {
    return <MarkdownBody content={content} />;
  }
  return <span className="whitespace-pre-wrap">{content}</span>;
}

function ActionButton({
  label,
  active,
  onClick,
  isUser,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  isUser: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-1 rounded-md transition-colors ${
        isUser
          ? active
            ? "text-white bg-white/20"
            : "text-white/70 hover:text-white hover:bg-white/15"
          : active
            ? "text-[var(--primary)] bg-[var(--primary-soft)]"
            : "text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-canvas)]"
      }`}
    >
      {children}
    </button>
  );
}

function MessageActions({
  message,
  isUser,
  canFork,
  onFeedback,
  onFork,
}: {
  message: ChatMessageType;
  isUser: boolean;
  canFork: boolean;
  onFeedback?: (messageId: string, rating: "like" | "dislike" | null) => void;
  onFork?: (messageId: string) => void;
}) {
  const { locale, t } = useI18n();
  const [copied, setCopied] = useState(false);
  const persisted = isPersistedMessage(message.id);
  const feedback = message.user_feedback;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      notify.success(t("chat.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error(locale === "zh-CN" ? "复制失败" : "Copy failed");
    }
  };

  const handleLike = () => {
    if (!persisted || !onFeedback) return;
    onFeedback(message.id, feedback === "like" ? null : "like");
  };

  const handleDislike = () => {
    if (!persisted || !onFeedback) return;
    onFeedback(message.id, feedback === "dislike" ? null : "dislike");
  };

  const iconClass = "h-3.5 w-3.5";

  return (
    <div
      className={`flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {persisted && onFeedback && (
        <>
          <ActionButton
            label={t("chat.like")}
            active={feedback === "like"}
            onClick={handleLike}
            isUser={isUser}
          >
            <DeimosIcon name="thumb-up" className={iconClass} />
          </ActionButton>
          <ActionButton
            label={t("chat.dislike")}
            active={feedback === "dislike"}
            onClick={handleDislike}
            isUser={isUser}
          >
            <DeimosIcon name="thumb-down" className={iconClass} />
          </ActionButton>
        </>
      )}
      <ActionButton
        label={copied ? t("chat.copied") : t("chat.copy")}
        onClick={handleCopy}
        isUser={isUser}
      >
        <DeimosIcon name={copied ? "check" : "copy"} className={iconClass} />
      </ActionButton>
      {canFork && persisted && onFork && (
        <ActionButton
          label={t("chat.forkHere")}
          onClick={() => onFork(message.id)}
          isUser={isUser}
        >
          <IconGitFork className={iconClass} />
        </ActionButton>
      )}
    </div>
  );
}

export type ChatMessageProps = {
  message: ChatMessageType;
  userIdentity?: ChatIdentity;
  agentIdentity?: ChatIdentity;
  canFork?: boolean;
  onFeedback?: (messageId: string, rating: "like" | "dislike" | null) => void;
  onFork?: (messageId: string) => void;
};

export default function ChatMessage({
  message,
  userIdentity,
  agentIdentity,
  canFork = false,
  onFeedback,
  onFork,
}: ChatMessageProps) {
  const { t } = useI18n();
  const isUser = message.role === "user";
  const activity = resolveActivityMeta(message.metadata);
  const isActivity = isActivityMessage(message);
  const isA2ADelegation = isActivity && activity?.is_a2a;
  const a2aCompleted = Boolean(activity?.a2a_completed);
  const isToolInProgress =
    isActivity && activity?.type === "tool_call" && !activity?.is_a2a;
  const contentType = resolveContentType(message);

  if (isA2ADelegation) {
    const targetAgentName = activity?.target_agent_name ?? "Agent";
    return (
      <div className="mb-4">
        <div
          className={`inline-flex flex-col gap-1.5 rounded-xl border px-4 py-3 max-w-[85%] ${
            a2aCompleted
              ? "border-[var(--teal)]/30 bg-[var(--teal-soft)]"
              : "border-[var(--primary)]/30 bg-[var(--primary-soft)]"
          }`}
        >
          <div className="flex items-center gap-2 text-[13px] font-medium">
            {a2aCompleted ? (
              <span className="text-[var(--teal)]">✓</span>
            ) : (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            )}
            <span
              className={
                a2aCompleted ? "text-[var(--teal)]" : "text-[var(--primary)]"
              }
            >
              {a2aCompleted ? t("chat.agentReply") : t("chat.communicating")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <WireframeAvatar
              kind="agent"
              entityId={activity?.target_agent_id ?? targetAgentName}
              name={targetAgentName}
              size={28}
            />
            <span className="text-sm font-medium text-[var(--title)]">
              {targetAgentName}
            </span>
          </div>
          {activity?.task && (
            <p className="text-[13px] text-[var(--text-muted)] leading-6">
              <DeimosIcon
                name="decision"
                className="mr-1 inline-block h-3 w-3"
              />
              {activity.task.length > 80
                ? activity.task.slice(0, 80) + "…"
                : activity.task}
            </p>
          )}
          {a2aCompleted && (
            <p className="text-[13px] text-[var(--text-secondary)] leading-6">
              {message.content.replace(/^✓\s*\S+\s*回复：/, "")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isToolInProgress || (isActivity && !isA2ADelegation)) {
    return (
      <div className="mb-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--teal-soft)] px-3 py-1.5 text-[13px] font-medium text-[var(--teal)]">
          <DeimosIcon name="tool" className="h-3 w-3" />
          {message.content}
        </span>
      </div>
    );
  }

  if (message.role === "system" && !isActivity) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-md border border-[var(--primary)] bg-[var(--primary-soft)] p-4 text-sm text-[var(--text-secondary)]">
        <DeimosIcon
          name="decision"
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
        />
        <span>{message.content}</span>
      </div>
    );
  }

  if (!isUser && !message.content.trim()) {
    return null;
  }

  const identity = isUser
    ? {
        id: message.actor_id || userIdentity?.id || "current-user",
        name: userIdentity?.name || t("chat.me"),
        avatarUrl: userIdentity?.avatarUrl,
      }
    : {
        id: message.actor_id || agentIdentity?.id || "deimos-agent",
        name: agentIdentity?.name || "Agent",
        avatarUrl: agentIdentity?.avatarUrl,
      };

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`flex gap-2.5 max-w-[88%] ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        <WireframeAvatar
          kind={isUser ? "user" : "agent"}
          entityId={identity.id}
          avatarUrl={identity.avatarUrl}
          name={identity.name}
          size={34}
          className="self-start"
        />
        <div
          className={`min-w-0 ${isUser ? "items-end" : "items-start"} flex flex-col`}
        >
          <div
            className={`rounded-md border px-4 py-3 text-[15px] leading-[1.75] ${
              isUser
                ? "border-[#6f94ee] bg-[#557bd8] text-white"
                : "border-[var(--rule)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            <MessageBody
              content={message.content}
              contentType={contentType}
              isUser={isUser}
            />
          </div>
          <MessageActions
            message={message}
            isUser={isUser}
            canFork={canFork}
            onFeedback={onFeedback}
            onFork={onFork}
          />
        </div>
      </div>
    </div>
  );
}
