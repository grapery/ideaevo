"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { IconSend } from "@/components/icons";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import { chatApi } from "@/lib/api-client";
import {
  type ChatAttachmentKind,
  type ChatAttachmentRef,
} from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

const QUICK_ACTIONS: { labelKey: TranslationKey; icon: DeimosIconName }[] = [
  { labelKey: "chat.quickSearchSimilar", icon: "semantic-search" },
  { labelKey: "chat.quickVerifyEvidence", icon: "evidence" },
  { labelKey: "chat.quickGeneratePlan", icon: "lifecycle" },
];

// 聊天附件限制（与后端 object_store.go 对齐）。
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_DOC_BYTES = 10 * 1024; // 10KB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_EXTENSIONS = [".md", ".markdown"];

function isImageFile(file: File): boolean {
  return IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function isMarkdownFile(file: File): boolean {
  return (
    file.type === "text/markdown" ||
    DOC_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (content: string, attachment?: ChatAttachmentRef) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachmentRef | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || sending || disabled) return;
    setSending(true);
    try {
      // 有附件时允许空文字（后端 content 可空）。
      await onSend(trimmed, attachment ?? undefined);
      setText("");
      setAttachment(null);
      setUploadError(null);
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

  const handleFileSelect = async (file: File) => {
    setUploadError(null);

    // 1. 前端预校验类型与大小。
    let kind: ChatAttachmentKind;
    if (isImageFile(file)) {
      kind = "image";
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError(t("chat.imageTooLarge", { size: formatSize(MAX_IMAGE_BYTES) }));
        return;
      }
    } else if (isMarkdownFile(file)) {
      kind = "document";
      if (file.size > MAX_DOC_BYTES) {
        setUploadError(t("chat.docTooLarge", { size: formatSize(MAX_DOC_BYTES) }));
        return;
      }
    } else {
      setUploadError(t("chat.attachmentTypeError"));
      return;
    }

    // 2. presign → PUT → finalize。
    setUploading(true);
    try {
      const att = await chatApi.uploadChatFile(file, kind);
      setAttachment({
        id: att.id,
        kind: att.kind,
        file_name: att.file_name,
        summary: att.summary,
        url: att.url,
        size: att.size,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("chat.attachmentFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelect(file);
    // 清空 value 以便重复选择同一文件。
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = () => {
    setAttachment(null);
    setUploadError(null);
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-4">
      <div className="mx-auto max-w-[820px]">
        {/* 附件预览条 */}
        {(attachment || uploading || uploadError) && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-[var(--rule)] bg-[var(--bg-subtle)] px-3 py-2">
            {uploading ? (
              <>
                <svg className="h-4 w-4 animate-spin text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                </svg>
                <span className="text-xs text-[var(--text-muted)]">{t("chat.uploadingAttachment")}</span>
              </>
            ) : attachment ? (
              <>
                {attachment.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.url}
                    alt={attachment.file_name}
                    className="h-10 w-10 rounded object-cover border border-[var(--rule)]"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded border border-[var(--rule)] text-[var(--text-muted)]">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-[var(--text-secondary)]">
                    {attachment.file_name}
                    <span className="ml-1.5 text-[var(--text-muted)]">{formatSize(attachment.size)}</span>
                  </div>
                  {attachment.summary && (
                    <div className="truncate text-xs text-[var(--text-muted)]">{attachment.summary}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={removeAttachment}
                  aria-label={t("chat.removeAttachment")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--rule)] hover:text-[var(--text-secondary)]"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : uploadError ? (
              <>
                <span className="text-xs text-[var(--accent-warn,#d97706)]">{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  {t("common.cancel")}
                </button>
              </>
            ) : null}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-md border border-[var(--rule)] bg-[var(--input-bg)] p-1.5 focus-within:border-[var(--accent-link)]">
          {/* 附件按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.md,.markdown,text/markdown,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending || disabled || !!attachment}
            aria-label={t("chat.addAttachment")}
            title={t("chat.addAttachment")}
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--rule)] hover:text-[var(--accent-link)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.402 18.471a1.5 1.5 0 01-2.122-2.121l9.902-9.902" />
            </svg>
          </button>

          <label htmlFor="chat-input" className="sr-only">{t("chat.inputPlaceholder")}</label>
          <Textarea
            ref={textareaRef}
            id="chat-input"
            name="message"
            variant="subtle"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder || t("chat.inputPlaceholder")}
            disabled={sending || disabled}
            rows={1}
            className="flex-1 resize-none min-h-[42px] max-h-[120px] !border-0 !bg-transparent !text-[15px] !leading-6 !shadow-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={(!text.trim() && !attachment) || sending || disabled}
            aria-label={t("chat.send")}
            className="inline-flex h-[42px] w-[42px] items-center justify-center rounded border border-[var(--accent-link)] bg-[var(--primary)] text-white shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--primary-hover)]"
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
              key={action.labelKey}
              type="button"
              onClick={() => setText(t(action.labelKey))}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--rule)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
            >
              <DeimosIcon name={action.icon} className="h-3 w-3" />
              {t(action.labelKey)}
            </button>
          ))}
          <span className="ml-auto hidden text-xs text-[var(--text-muted)] sm:inline">
            {t("chat.enterSendHint")}
          </span>
        </div>
      </div>
    </div>
  );
}
