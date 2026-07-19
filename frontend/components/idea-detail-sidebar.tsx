"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Idea, FlowerDonor, IdeaLineage, IdeaStats } from "@/lib/types";
import { SendFlowerButton } from "./idea-action-bar";
import { ForkFlowGraph } from "./fork-flow-graph";
import { WireframeAvatar } from "./wireframe-avatar";
import { Modal } from "./ui/modal";
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
  lineage,
}: {
  idea: Idea;
  forks: ForkRecord[];
  lineage?: IdeaLineage | null;
}) {
  return (
    <div className="surface-card p-5">
      <h3 className={`${sidebarTitleClass} mb-3`}>Fork 谱系</h3>

      {lineage && (
        <div className="mb-3 space-y-2 text-xs">
          {lineage.source_idea && (
            <div className="rounded-md border border-[var(--rule)] bg-[var(--bg-subtle)] p-2.5">
              <div className="mb-0.5 text-[var(--text-muted)]">衍生自</div>
              <Link
                href={`/ideas/${lineage.source_idea.id}`}
                className="block truncate font-medium text-[var(--ink)] hover:text-[var(--primary)]"
              >
                {lineage.source_idea.title}
              </Link>
              {lineage.source_version && (
                <div className="mt-0.5 text-[var(--text-muted)]">
                  版本 v{lineage.source_version.version}
                  {lineage.origin?.reason && ` · ${lineage.origin.reason}`}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-muted)]">
            <span>共 {lineage.stats.total_forks} 个 Fork</span>
            <span>{lineage.stats.active_branches} 个活跃分支</span>
            <span>{lineage.stats.contributors} 位贡献者</span>
          </div>
        </div>
      )}

      <ForkFlowGraph idea={idea} forks={forks} />
    </div>
  );
}

function donorProfileHref(donor: FlowerDonor): string | undefined {
  if (donor.user_id) return `/users/${donor.user_id}`;
  if (donor.agent_id) return `/agents/${donor.agent_id}`;
  return undefined;
}

export function FlowersPanel({
  ideaId,
  flowerCount,
  initialDonors = [],
}: {
  ideaId: string;
  flowerCount: number;
  initialDonors?: FlowerDonor[];
}) {
  const [donors, setDonors] = useState<FlowerDonor[]>(initialDonors);
  const [loaded, setLoaded] = useState(initialDonors.length > 0 || flowerCount === 0);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBase()}/ideas/${ideaId}/flowers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { donors: [] }))
      .then((data) => {
        if (!cancelled) setDonors(data.donors || []);
      })
      .catch(() => {
        if (!cancelled && initialDonors.length === 0) setDonors([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, flowerCount, initialDonors.length]);

  const displayDonors = donors.slice(0, 12);
  const hiddenDonorCount = Math.max(0, donors.length - displayDonors.length);
  const canExpand = donors.length > 0;

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
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="mb-2.5 flex flex-wrap items-center gap-2 rounded-md p-1 -m-1 text-left transition-colors hover:bg-[var(--bg-subtle)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink-faint)] cursor-pointer"
          aria-label={`查看全部 ${donors.length} 位送花者`}
          title="点击查看全部送花者"
        >
          {displayDonors.map((donor) => (
            <WireframeAvatar
              key={donor.user_id || donor.agent_id || donor.name}
              name={donor.name}
              avatarUrl={donor.avatar_url}
              entityId={donor.user_id || donor.agent_id}
              kind={donor.user_id ? "user" : "agent"}
              size={36}
              title={donor.name}
            />
          ))}
          {hiddenDonorCount > 0 && (
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 text-xs tabular-nums text-[var(--text-muted)]">
              +{hiddenDonorCount}
            </span>
          )}
        </button>
      ) : flowerCount > 0 ? (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">送花者信息加载失败</p>
      ) : (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">还没有人送花</p>
      )}
      <p className="mb-3 text-xs tabular-nums text-[var(--text-muted)]">
        累计 {flowerCount} 朵鲜花
        {canExpand && (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="ml-2 text-[var(--accent-link)] hover:underline"
          >
            查看全部 →
          </button>
        )}
      </p>
      <SendFlowerButton ideaId={ideaId} />

      {canExpand && (
        <Modal
          open={listOpen}
          onClose={() => setListOpen(false)}
          title={`送花者（${donors.length}）`}
          description="为这个想法献过花的用户与 Agent"
        >
          <ul className="-mx-1 max-h-[60vh] space-y-1 overflow-y-auto">
            {donors.map((donor) => {
              const href = donorProfileHref(donor);
              const inner = (
                <>
                  <WireframeAvatar
                    name={donor.name}
                    avatarUrl={donor.avatar_url}
                    entityId={donor.user_id || donor.agent_id}
                    kind={donor.user_id ? "user" : "agent"}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--title)]">
                      {donor.name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {donor.user_id ? "用户" : "Agent"}
                      {donor.created_at && (
                        <> · {new Date(donor.created_at).toLocaleDateString("zh-CN")}</>
                      )}
                    </div>
                  </div>
                </>
              );
              return (
                <li key={donor.user_id || donor.agent_id || donor.name}>
                  {href ? (
                    <Link
                      href={href}
                      onClick={() => setListOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--bg-subtle)]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg px-3 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
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

export function IdeaStatsPanel({ idea, stats }: { idea: Idea; stats?: IdeaStats | null }) {
  const rows: [string, number][] = stats
    ? [
        ["点赞", stats.like_count],
        ["鲜花", stats.flower_count],
        ["Fork", stats.fork_count],
        ["评论", stats.comment_count],
        ["浏览", stats.view_count],
        ["引用", stats.reference_count],
        ["表情反应", stats.reaction_count],
        ["版本", stats.version_count],
        ["图片", stats.image_count],
        ["链接", stats.link_count],
      ]
    : [
        ["点赞", idea.like_count],
        ["鲜花", idea.flower_count],
        ["Fork", idea.fork_count],
        ["评论", idea.comment_count],
      ];

  return (
    <div className={sidebarCardClass}>
      <h3 className={`${sidebarTitleClass} mb-3`}>想法统计</h3>
      <div className="space-y-2.5 text-sm">
        {rows.map(([label, count]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="font-medium tabular-nums text-[var(--title)]">{count}</span>
          </div>
        ))}
      </div>
      {stats && stats.version_stats.length > 1 && (
        <div className="mt-4 border-t border-[var(--divider)] pt-3">
          <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">各版本互动</p>
          <div className="space-y-1.5">
            {stats.version_stats.map((row) => (
              <div
                key={row.version_id}
                className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]"
              >
                <span>v{row.version}</span>
                <span className="tabular-nums">
                  Fork {row.stats.fork_count} · 评论 {row.stats.comment_count} · 花{" "}
                  {row.stats.flower_count} · 反应 {row.stats.reaction_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
