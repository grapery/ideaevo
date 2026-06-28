"use client";

import Link from "next/link";
import { Idea } from "@/lib/types";
import { SendFlowerButton } from "./idea-action-bar";
import { ForkFlowGraph } from "./fork-flow-graph";

const sidebarCardClass = "surface-card p-5";
const sidebarTitleClass = "heading-sans text-sm pb-2 mb-3 border-b border-[var(--divider)]";

interface ForkRecord {
  id: string;
  source_idea_id: string;
  new_idea_id: string;
  agent_id: string;
  reason: string;
  created_at: string;
}

export function ForkTreePanel({
  idea,
  forks,
}: {
  idea: Idea;
  forks: ForkRecord[];
}) {
  return <ForkFlowGraph idea={idea} forks={forks} />;
}

export function FlowersPanel({ ideaId, flowerCount }: { ideaId: string; flowerCount: number }) {
  const avatarCount = Math.min(flowerCount, 8);

  return (
    <div className={sidebarCardClass}>
      <h3 className={`${sidebarTitleClass} mb-3`}>
        <span aria-hidden="true" className="mr-1">
          🌸
        </span>
        收到的花
      </h3>
      {avatarCount > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {Array.from({ length: avatarCount }).map((_, i) => (
            <div
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[13px] font-semibold text-[var(--primary)]"
            >
              {String.fromCharCode(65 + (i % 26))}
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">还没有人送花</p>
      )}
      <p className="mb-3 text-xs tabular-nums text-[var(--text-muted)]">
        累计 {flowerCount} 朵鲜花
      </p>
      <SendFlowerButton ideaId={ideaId} />
    </div>
  );
}

export function RelatedIdeasPanel({ ideas, currentId }: { ideas: Idea[]; currentId: string }) {
  const related = ideas.filter((i) => i.id !== currentId).slice(0, 3);
  if (related.length === 0) return null;

  return (
    <div className={sidebarCardClass}>
      <h3 className={`${sidebarTitleClass} mb-3`}>相关想法</h3>
      <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
        {related.map((item) => (
          <li key={item.id}>
            <Link href={`/ideas/${item.id}`} className="hover:text-[var(--primary)]">
              • {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IdeaStatsPanel({ idea }: { idea: Idea }) {
  return (
    <div className={sidebarCardClass}>
      <h3 className={`${sidebarTitleClass} mb-3`}>想法统计</h3>
      <div className="space-y-2.5 text-sm">
        {[
          ["点赞", idea.like_count],
          ["鲜花", idea.flower_count],
          ["Fork", idea.fork_count],
          ["评论", idea.comment_count],
        ].map(([label, count]) => (
          <div key={label as string} className="flex items-center justify-between gap-4">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="font-medium tabular-nums text-[var(--title)]">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
