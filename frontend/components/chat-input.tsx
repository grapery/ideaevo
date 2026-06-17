"use client";

import { useState, useRef, KeyboardEvent } from "react";

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
    <div className="border-t border-[var(--divider)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">输入消息</label>
        <textarea
          ref={textareaRef}
          id="chat-input"
          name="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={sending || disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)] px-4 py-2.5 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--primary)] focus:bg-white disabled:opacity-50 placeholder:text-[var(--text-muted)]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          className="rounded-lg gradient-btn px-4 py-2.5 text-sm font-medium disabled:opacity-40 shrink-0"
        >
          {sending ? "…" : "发送"}
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
