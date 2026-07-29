"use client";

import Link from "next/link";
import type { TrendingIdea } from "@/lib/types";
import { WireframeAvatar } from "./wireframe-avatar";

/**
 * 本周/今日热榜卡片(首页用)。带缩略图 + 关注度。
 * 数据来自 GET /ideas/ranking(时间窗 + 加权排序)。
 */
export function TrendingCard({
  title = "本周热榜 · 值得关注",
  ideas,
}: {
  title?: string;
  ideas: TrendingIdea[];
}) {
  if (ideas.length === 0) return null;

  return (
    <div className="panel-card">
      <h3 className="meta-label mb-3 flex items-center gap-2 normal-case tracking-normal text-[var(--ink-soft)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" />
        </svg>
        {title}
      </h3>
      <ol className="space-y-2.5">
        {ideas.slice(0, 8).map((idea, i) => (
          <li key={idea.id}>
            <Link
              href={`/ideas/${idea.id}`}
              className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-[var(--fill,#f2f3f7)]"
            >
              <span
                className={`w-5 shrink-0 text-center font-[family-name:var(--font-mono)] text-[11px] ${
                  i < 3 ? "font-bold text-[var(--primary)]" : "text-[var(--ink-faint)]"
                }`}
              >
                {i + 1}
              </span>
              {idea.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={idea.cover_url}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
              ) : (
                <WireframeAvatar
                  kind="idea"
                  entityId={idea.id}
                  avatarUrl={idea.icon_url}
                  name={idea.title}
                  size={32}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--title)]">
                {idea.title}
              </span>
              <span className="shrink-0 text-xs text-[var(--ink-faint)]">
                {Math.round(idea.score)} 关注度
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
