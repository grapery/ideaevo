"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ideaRequestJson } from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

const EMOJIS = ["👍", "🎉", "🚀", "❤️", "👀"];

/**
 * ReactionBar — GitHub 式 emoji 反应。
 * 点击「+」触发器弹出 emoji 选择气泡，可多选多个 emoji（各自 toggle）。
 * 有计数时显示对应 emoji 的 pill。
 */
export function ReactionBar({
  ideaId,
  initialCounts = {},
  initialMine = [],
  compact = false,
}: {
  ideaId: string;
  initialCounts?: Record<string, number>;
  initialMine?: string[];
  compact?: boolean;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [mine, setMine] = useState<string[]>(initialMine);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

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
        notify.error(t("idea.authRequired"));
        return;
      }
      setLoading(true);
      setOpen(false);
      const prevCounts = { ...counts };
      const prevMine = [...mine];
      const selected = mine.includes(emoji);

      if (selected) {
        // 取消该 emoji
        setMine((m) => m.filter((e) => e !== emoji));
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
            body: JSON.stringify({ emoji }),
          });
        } catch (err) {
          setCounts(prevCounts);
          setMine(prevMine);
          notify.error(getErrorMessage(err, t("common.operationFailed")));
        }
      } else {
        // 新增该 emoji（多选，不影响已选的其它 emoji）
        setMine((m) => [...m, emoji]);
        setCounts((c) => {
          const n = { ...c };
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
          notify.error(getErrorMessage(err, t("common.operationFailed")));
        }
      }
      setLoading(false);
    },
    [apiKey, canAct, counts, ideaId, mine, useSession],
  );

  // 有计数的 emoji（用于展示 pill）
  const countedEmojis = EMOJIS.filter((e) => counts[e] > 0);

  if (countedEmojis.length === 0 && !canAct) return null;

  return (
    <div
      ref={popRef}
      className={`relative inline-flex items-center gap-1.5 ${compact ? "" : ""}`}
    >
      {/* 已有反应的 pill（可点击切换/取消） */}
      {countedEmojis.map((emoji) => {
        const count = counts[emoji];
        const selected = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={loading || !canAct}
            onClick={() => toggle(emoji)}
            className={`inline-flex items-center gap-1 filter-chip disabled:opacity-50 ${
              selected ? "border-[var(--ink)] text-[var(--ink)]" : ""
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
            aria-label={t("common.addReaction")}
            className="filter-chip disabled:opacity-50"
          >
            <DeimosIcon name="smile" className="h-3.5 w-3.5" />
          </button>

          {/* emoji 选择气泡 */}
          {open && (
            <div className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-1 border border-[var(--rule)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-lg)]">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  disabled={loading}
                  className={`btn-icon h-8 w-8 text-base disabled:opacity-50 ${
                    mine.includes(emoji) ? "border-[var(--ink)]" : ""
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
