"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";

const EMOJIS = ["👍", "🎉", "🚀", "❤️", "👀"];

/**
 * ReactionBar — GitHub 式 emoji 反应。
 * 点击「+」触发器弹出 emoji 选择气泡，单选一个 emoji（切换/取消）。
 * 有计数时显示已选 emoji 的 pill。
 */
export function ReactionBar({
  ideaId,
  initialCounts = {},
  initialMine = "",
  compact = false,
}: {
  ideaId: string;
  initialCounts?: Record<string, number>;
  initialMine?: string;
  compact?: boolean;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [mine, setMine] = useState(initialMine);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭气泡
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = useCallback(
    async (emoji: string) => {
      if (!canAct) {
        notify.error(IDEA_AUTH_REQUIRED_MSG);
        return;
      }
      setLoading(true);
      setOpen(false);
      const prevCounts = { ...counts };
      const prevMine = mine;

      if (mine === emoji) {
        // 取消
        setMine("");
        setCounts((c) => {
          const n = { ...c };
          if (n[emoji]) n[emoji]--;
          if (n[emoji] <= 0) delete n[emoji];
          return n;
        });
        try {
          await ideaRequestJson(`/ideas/${ideaId}/reactions`, {
            method: "DELETE",
            apiKey: useSession ? undefined : apiKey,
            useSession,
          });
        } catch (err) {
          setCounts(prevCounts);
          setMine(prevMine);
          notify.error(getErrorMessage(err, "操作失败"));
        }
      } else {
        // 新选或切换
        setMine(emoji);
        setCounts((c) => {
          const n = { ...c };
          if (prevMine && n[prevMine]) {
            n[prevMine]--;
            if (n[prevMine] <= 0) delete n[prevMine];
          }
          n[emoji] = (n[emoji] || 0) + 1;
          return n;
        });
        try {
          await ideaRequestJson(`/ideas/${ideaId}/reactions`, {
            method: "POST",
            apiKey: useSession ? undefined : apiKey,
            useSession,
            body: JSON.stringify({ emoji }),
          });
        } catch (err) {
          setCounts(prevCounts);
          setMine(prevMine);
          notify.error(getErrorMessage(err, "操作失败"));
        }
      }
      setLoading(false);
    },
    [apiKey, canAct, counts, ideaId, mine, useSession]
  );

  // 有计数的 emoji（用于展示 pill）
  const countedEmojis = EMOJIS.filter((e) => counts[e] > 0);

  if (countedEmojis.length === 0 && !canAct) return null;

  return (
    <div ref={popRef} className={`relative inline-flex items-center gap-1.5 ${compact ? "" : ""}`}>
      {/* 已有反应的 pill（可点击切换/取消） */}
      {countedEmojis.map((emoji) => {
        const count = counts[emoji];
        const selected = mine === emoji;
        return (
          <button
            key={emoji}
            type="button"
            disabled={loading || !canAct}
            onClick={() => toggle(emoji)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors disabled:opacity-50 ${
              selected
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--divider)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            } ${canAct ? "cursor-pointer" : "cursor-default"}`}
          >
            <span>{emoji}</span>
            <span className="text-xs tabular-nums">{count}</span>
          </button>
        );
      })}

      {/* 触发器：+ 表情（弹出选择气泡） */}
      {canAct && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={loading}
            aria-label="添加表情反应"
            className="inline-flex items-center justify-center rounded-full border border-[var(--divider)] px-2.5 py-1 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)] disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
            </svg>
          </button>

          {/* emoji 选择气泡 */}
          {open && (
            <div className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-1 rounded-full border border-[var(--divider)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-lg)]">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  disabled={loading}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 disabled:opacity-50 ${
                    mine === emoji ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
