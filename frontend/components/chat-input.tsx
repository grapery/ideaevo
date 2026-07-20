"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { IconSend } from "@/components/icons";

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
    <div className="border-t border-[var(--border)] bg-[var(--bg-canvas)] p-4">
      <div className="flex items-end gap-2">
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
          className="flex-1 resize-none min-h-[42px] max-h-[120px]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          aria-label="发送"
          className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-md border border-[var(--ink)] bg-[var(--ink)] text-[var(--bg-surface)] shrink-0 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
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
      <div className="mt-2 flex flex-wrap gap-2">
        {["查询想法", "去重检测", "Fork 建议"].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setText(chip)}
            className="rounded-full bg-[var(--bg-subtle)] px-3 py-0.5 text-xs text-[var(--text-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
