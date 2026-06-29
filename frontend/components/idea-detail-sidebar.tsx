"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Idea, FlowerDonor } from "@/lib/types";
import { SendFlowerButton } from "./idea-action-bar";
import { ForkFlowGraph } from "./fork-flow-graph";
import { WireframeAvatar } from "./wireframe-avatar";
import { getApiBase } from "@/lib/api-base";
import { IconGitFork, IconMessage } from "./icons";

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

export function FlowersPanel({
  ideaId,
  flowerCount,
}: {
  ideaId: string;
  flowerCount: number;
}) {
  const [donors, setDonors] = useState<FlowerDonor[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${getApiBase()}/ideas/${ideaId}/flowers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { donors: [] }))
      .then((data) => setDonors(data.donors || []))
      .catch(() => setDonors([]))
      .finally(() => setLoaded(true));
  }, [ideaId, flowerCount]);

  const displayDonors = donors.slice(0, 12);

  return (
    <div className={sidebarCardClass}>
      <h3 className={`${sidebarTitleClass} mb-3`}>
        <span aria-hidden="true" className="mr-1">
          🌸
        </span>
        收到的花
      </h3>
      {!loaded ? (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">加载中…</p>
      ) : displayDonors.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {displayDonors.map((donor) => (
            <WireframeAvatar
              key={`${donor.user_id || donor.agent_id}-${donor.created_at}`}
              name={donor.name}
              avatarUrl={donor.avatar_url}
              size={36}
              title={donor.name}
            />
          ))}
        </div>
      ) : flowerCount > 0 ? (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">送花者信息加载失败</p>
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
      <ul className="space-y-3 text-sm">
        {related.map((item) => (
          <li key={item.id}>
            <Link
              href={`/ideas/${item.id}`}
              className="block text-[var(--text-secondary)] hover:text-[var(--primary)]"
            >
              <span className="font-medium text-[var(--title)]">{item.title}</span>
              <span className="mt-1 flex items-center gap-3 text-[11px] tabular-nums text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-0.5">
                  <IconMessage className="h-3 w-3" />
                  {item.comment_count}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <IconGitFork className="h-3 w-3" />
                  {item.fork_count}
                </span>
              </span>
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
