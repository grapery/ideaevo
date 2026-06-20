"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { ChatMessage as ChatMessageType, MessageContentType } from "@/lib/types";
import { IconGitFork } from "./icons";

function resolveContentType(message: ChatMessageType): MessageContentType {
  if (message.content_type) return message.content_type;
  if (message.role === "assistant") return "markdown";
  return "text";
}

function isPersistedMessage(id: string): boolean {
  return id.length > 0 && !id.startsWith("temp-") && !id.startsWith("error-") && !id.startsWith("tool-");
}

function JsonBlock({ content }: { content: string }) {
  let formatted = content;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // keep raw string
  }
  return (
    <pre className="overflow-x-auto rounded-lg bg-[var(--bg-canvas)] p-3 text-xs leading-relaxed font-mono">
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
          <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 mt-2.5 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--title)]">{children}</strong>,
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
              <code className="block overflow-x-auto rounded-lg bg-[var(--bg-canvas)] p-3 text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-[var(--bg-canvas)] px-1 py-0.5 text-[0.85em] font-mono">
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
  const [copied, setCopied] = useState(false);
  const persisted = isPersistedMessage(message.id);
  const feedback = message.user_feedback;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
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
            label="点赞"
            active={feedback === "like"}
            onClick={handleLike}
            isUser={isUser}
          >
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M4 21h4v-9H4v9z"
              />
            </svg>
          </ActionButton>
          <ActionButton
            label="点踩"
            active={feedback === "dislike"}
            onClick={handleDislike}
            isUser={isUser}
          >
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M20 3h-4v9h4V3z"
              />
            </svg>
          </ActionButton>
        </>
      )}
      <ActionButton label={copied ? "已复制" : "复制"} onClick={handleCopy} isUser={isUser}>
        {copied ? (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </ActionButton>
      {canFork && persisted && onFork && (
        <ActionButton label="从此处分支" onClick={() => onFork(message.id)} isUser={isUser}>
          <IconGitFork className={iconClass} />
        </ActionButton>
      )}
    </div>
  );
}

export type ChatMessageProps = {
  message: ChatMessageType;
  canFork?: boolean;
  onFeedback?: (messageId: string, rating: "like" | "dislike" | null) => void;
  onFork?: (messageId: string) => void;
};

export default function ChatMessage({
  message,
  canFork = false,
  onFeedback,
  onFork,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const meta = message.metadata as { type?: string } | undefined;
  const isToolCall = meta?.type === "tool_call";
  const contentType = resolveContentType(message);

  if (isToolCall) {
    return (
      <div className="mb-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--teal-soft)] px-3 py-1 text-xs font-medium text-[var(--teal)]">
          ⚡ {message.content}
        </span>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="mb-4 rounded-xl border border-[var(--primary)] bg-[var(--primary-soft)] p-4 text-sm text-[var(--text-secondary)]">
        {message.content}
      </div>
    );
  }

  if (!isUser && !message.content.trim()) {
    return null;
  }

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`flex gap-2 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 self-start ${
            isUser
              ? "bg-[var(--primary)] text-white"
              : "bg-[var(--primary-soft)] text-[var(--primary)]"
          }`}
        >
          {isUser ? "我" : "A"}
        </div>
        <div className={`min-w-0 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "bg-[var(--primary)] text-white rounded-br-md"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] rounded-bl-md"
            }`}
          >
            <MessageBody content={message.content} contentType={contentType} isUser={isUser} />
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
