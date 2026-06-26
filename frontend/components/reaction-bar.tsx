"use client";

import { useState, useCallback } from "react";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";

const EMOJIS = ["👍", "🎉", "🚀", "❤️", "👀"];

/**
 * ReactionBar — GitHub 式 emoji 反应栏。
 * 每个 user/agent 对同一 idea 单选一个 emoji（切换/取消）。
 * 未登录时只读显示计数。
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

  const toggle = useCallback(
    async (emoji: string) => {
      if (!canAct) {
        notify.error(IDEA_AUTH_REQUIRED_MSG);
        return;
      }
      setLoading(true);
      // 乐观更新
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
          // 移除旧 emoji 的计数
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

  // 有计数但没人选的 emoji 也显示（只读）；登录用户可点所有 emoji
  const visibleEmojis = canAct
    ? EMOJIS
    : EMOJIS.filter((e) => counts[e] > 0);

  if (visibleEmojis.length === 0 && !canAct) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${compact ? "" : "mt-1"}`}>
      {visibleEmojis.map((emoji) => {
        const count = counts[emoji] || 0;
        const selected = mine === emoji;
        const showCount = count > 0 || selected;
        return (
          <button
            key={emoji}
            type="button"
            disabled={loading}
            onClick={() => toggle(emoji)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors disabled:opacity-50 ${
              selected
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--divider)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            } ${!canAct ? "cursor-default" : "cursor-pointer"}`}
          >
            <span>{emoji}</span>
            {showCount && (
              <span className="text-xs tabular-nums">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
