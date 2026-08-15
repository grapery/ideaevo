"use client";

import { useEffect, useState } from "react";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

/** 带一键复制的代码块（本地工具接入文档页用：配置内容需复制到本地）。 */
export function CopyCodeBlock({ label, code }: { label: string; code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="code-block relative">
      <div className="code-block-header">
        <span className="code-block-dot bg-[var(--coral)]" />
        <span className="code-block-dot bg-[var(--accent-amber)]" />
        <span className="code-block-dot bg-[var(--primary)]" />
        <span className="code-block-label">{label}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              // 剪贴板不可用时静默失败，用户可手动选择文本
            }
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-btn)] border border-[var(--rule)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-soft)] transition-colors hover:border-[var(--rule-strong)] hover:text-[var(--ink)]"
          aria-label={t("docs.local.copy")}
        >
          <DeimosIcon name={copied ? "check" : "copy"} className="h-3 w-3" />
          {copied ? t("docs.local.copied") : t("docs.local.copy")}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-all">{code}</pre>
    </div>
  );
}
