"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { IconSend } from "@/components/icons";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";

const QUICK_ACTIONS: { label: string; icon: DeimosIconName }[] = [
  { label: "搜索相似想法", icon: "semantic-search" },
  { label: "验证关键证据", icon: "evidence" },
  { label: "生成实现计划", icon: "lifecycle" },
];

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "输入消息，Shift+Enter 换行…",
}: {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4">
      <div className="mx-auto max-w-[820px]">
        <div className="flex items-end gap-2 rounded-md border border-[var(--rule)] bg-[var(--input-bg)] p-1.5 focus-within:border-[var(--accent-link)]">
          <label htmlFor="chat-input" className="sr-only">输入消息</label>
          <Textarea
            ref={textareaRef}
            id="chat-input"
            name="message"
            variant="subtle"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={sending || disabled}
            rows={1}
            className="flex-1 resize-none min-h-[38px] max-h-[120px] !border-0 !bg-transparent !shadow-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || sending || disabled}
            aria-label="发送"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded border border-[var(--accent-link)] bg-[var(--accent-link)] text-white shrink-0 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            {sending ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
              </svg>
            ) : (
              <IconSend className="h-4 w-4 pointer-events-none" />
            )}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => setText(action.label)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
            >
              <DeimosIcon name={action.icon} className="h-3 w-3" />
              {action.label}
            </button>
          ))}
          <span className="ml-auto hidden text-[10px] text-[var(--text-muted)] sm:inline">
            Enter 发送 · Shift+Enter 换行
          </span>
        </div>
      </div>
    </div>
  );
}
