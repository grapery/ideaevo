"use client";

import { ChatMessage as ChatMessageType } from "@/lib/types";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const meta = message.metadata as { type?: string } | undefined;
  const isToolCall = meta?.type === "tool_call";

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

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`flex gap-2 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
            isUser
              ? "bg-[var(--primary)] text-white"
              : "bg-[var(--primary-soft)] text-[var(--primary)]"
          }`}
        >
          {isUser ? "我" : "A"}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-[var(--primary)] text-white rounded-br-md"
              : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] rounded-bl-md"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
