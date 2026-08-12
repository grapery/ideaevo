"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Idea, FlowerSender, IdeaLineage, IdeaStats } from "@/lib/types";
import { SendFlowerButton } from "./idea-action-bar";
import { ForkFlowGraph } from "./fork-flow-graph";
import { WireframeAvatar } from "./wireframe-avatar";
import { Modal } from "./ui/modal";
import { getApiBase } from "@/lib/api-base";
import { IconGitFork, IconMessage } from "./icons";
import { DeimosIcon } from "./deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

const sidebarCardClass = "surface-card p-5";
const sidebarTitleClass = "heading-sans text-sm pb-2 mb-3 border-b border-[var(--divider)]";

export function ForkTreePanel({
  idea,
  lineage,
}: {
  idea: Idea;
  lineage?: IdeaLineage | null;
}) {
  const { t } = useI18n();
  return (
    <div className="surface-card p-5">
      <h3 className={`${sidebarTitleClass} mb-3`}>{t("idea.forkLineageShort")}</h3>

      {lineage && (
        <div className="mb-3 space-y-2 text-xs">
          {lineage.source_idea && (
            <div className="rounded-md border border-[var(--rule)] bg-[var(--bg-subtle)] p-2.5">
              <div className="mb-0.5 text-[var(--text-muted)]">{t("idea.forkedFrom")}</div>
              <Link
                href={`/ideas/${lineage.source_idea.id}`}
                className="block truncate font-medium text-[var(--ink)] hover:text-[var(--primary)]"
              >
                {lineage.source_idea.title}
              </Link>
              {lineage.source_version && (
                <div className="mt-0.5 text-[var(--text-muted)]">
                  {t("idea.versionBadge", { version: lineage.source_version.version })}
                  {lineage.origin?.reason && ` · ${lineage.origin.reason}`}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-muted)]">
            <span>{t("idea.totalForks", { count: lineage.stats.total_forks })}</span>
            <span>{t("idea.activeBranches", { count: lineage.stats.active_branches })}</span>
            <span>{t("idea.contributors", { count: lineage.stats.contributors })}</span>
          </div>
        </div>
      )}

      <ForkFlowGraph idea={idea} lineage={lineage ?? null} children={[]} />
    </div>
  );
}

function senderProfileHref(sender: FlowerSender): string | undefined {
  if (sender.user_id) return `/users/${sender.user_id}`;
  if (sender.agent_id) return `/agents/${sender.agent_id}`;
  return undefined;
}

/** 送花面板：计数 + 送花者头像名单 + 送花按钮。 */
export function FlowersPanel({
  ideaId,
  flowerCount,
  initialSenders = [],
}: {
  ideaId: string;
  flowerCount: number;
  initialSenders?: FlowerSender[];
}) {
  const { locale, t } = useI18n();
  const [senders, setSenders] = useState<FlowerSender[]>(initialSenders);
  const [loaded, setLoaded] = useState(initialSenders.length > 0 || flowerCount === 0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBase()}/ideas/${ideaId}/flowers`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("flowers fetch failed");
        return r.json();
      })
      .then((data) => {
        // 后端字段仍为 donors，前端按送花者展示
        if (!cancelled) setSenders(data.donors || []);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
          if (initialSenders.length === 0) setSenders([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, flowerCount, initialSenders.length, retryToken]);

  const displaySenders = senders.slice(0, 12);
  const hiddenCount = Math.max(0, senders.length - displaySenders.length);
  const canExpand = senders.length > 0;

  return (
    <div className="rounded-lg border border-[#ffb45a] bg-[#fff4e6] p-5 text-[#914700]">
      <h3 className="mb-3 border-b border-[#ffcf93] pb-2 text-[12px] font-semibold">
        <DeimosIcon name="flower" className="mr-1 inline-block h-3.5 w-3.5 text-[#ff8a00]" />
        {t("idea.flowerSignals")} / {t("idea.flowerCountLabel", { count: flowerCount })}
      </h3>
      {!loaded ? (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">{t("common.loading")}</p>
      ) : displaySenders.length > 0 ? (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="mb-2.5 -m-1 flex flex-wrap items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-[var(--bg-subtle)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink-faint)] cursor-pointer"
          aria-label={t("common.viewAll")}
          title={t("common.viewAll")}
        >
          {displaySenders.map((sender) => (
            <WireframeAvatar
              key={sender.user_id || sender.agent_id || sender.name}
              name={sender.name}
              avatarUrl={sender.avatar_url}
              entityId={sender.user_id || sender.agent_id}
              kind={sender.user_id ? "user" : "agent"}
              size={36}
              title={sender.name}
            />
          ))}
          {hiddenCount > 0 && (
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 text-xs tabular-nums text-[var(--text-muted)]">
              +{hiddenCount}
            </span>
          )}
        </button>
      ) : loadFailed ? (
        <div className="mb-2.5">
          <p className="text-sm text-[var(--text-muted)]">{t("idea.flowerLoadFailed")}</p>
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
              setLoadFailed(false);
              setRetryToken((n) => n + 1);
            }}
            className="mt-1 text-xs text-[var(--primary)] hover:underline"
          >
            {t("idea.reload")}
          </button>
        </div>
      ) : flowerCount > 0 ? (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">{t("idea.flowerUnavailable")}</p>
      ) : (
        <p className="mb-2.5 text-sm text-[var(--text-muted)]">{t("idea.noFlowers")}</p>
      )}
      <p className="mb-3 font-code text-[10px] tabular-nums text-[#914700]/70">
        {t("idea.flowerCountLabel", { count: flowerCount })}
        {canExpand && (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="ml-2 text-[var(--accent-link)] hover:underline"
          >
            {t("common.viewAll")} →
          </button>
        )}
      </p>
      <SendFlowerButton ideaId={ideaId} />

      {canExpand && (
        <Modal
          open={listOpen}
          onClose={() => setListOpen(false)}
          title={t("idea.flowerSenders", { count: senders.length })}
          description={t("idea.flowerSignals")}
        >
          <ul className="-mx-1 max-h-[60vh] space-y-1 overflow-y-auto">
            {senders.map((sender) => {
              const href = senderProfileHref(sender);
              const inner = (
                <>
                  <WireframeAvatar
                    name={sender.name}
                    avatarUrl={sender.avatar_url}
                    entityId={sender.user_id || sender.agent_id}
                    kind={sender.user_id ? "user" : "agent"}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--title)]">
                      {sender.name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {sender.user_id ? t("activity.user") : t("activity.agent")}
                      {sender.created_at && (
                        <>
                          {" · "}
                          {new Date(sender.created_at).toLocaleDateString(
                            locale === "en" ? "en-US" : "zh-CN",
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              );
              return (
                <li key={sender.user_id || sender.agent_id || sender.name}>
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
  const { t } = useI18n();
  const related = ideas.filter((i) => i.id !== currentId).slice(0, 3);
  if (related.length === 0) return null;

  return (
    <div className={sidebarCardClass}>
      <h3 className={`${sidebarTitleClass} mb-3`}>{t("idea.relatedIdeas")}</h3>
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
  const { t } = useI18n();
  const wishCount = stats?.wish_count ?? idea.wish_count ?? 0;
  const flowerCount = stats?.flower_count ?? idea.flower_count ?? 0;

  // 主指标(社区互动核心信号):稍大字号、强调色值,顶部突出展示。
  const primary: [string, number][] = [
    [t("idea.statLikes"), stats?.like_count ?? idea.like_count],
    [t("idea.statWishes"), wishCount],
    [t("idea.statFlowers"), flowerCount],
    [t("idea.statForks"), stats?.fork_count ?? idea.fork_count],
    [t("idea.statComments"), stats?.comment_count ?? idea.comment_count],
  ];
  // 次要指标(参考性):小字号、淡色,折叠到底部。
  const secondary: [string, number][] = stats
    ? [
        [t("idea.statViews"), stats.view_count],
        [t("idea.statRefs"), stats.reference_count],
        [t("idea.statReactions"), stats.reaction_count],
        [t("idea.statVersions"), stats.version_count],
      ]
    : [];

  return (
    <div className="surface-card p-5">
      <h3 className="mb-4 border-b border-[var(--divider)] pb-3 text-[13px] font-semibold text-[var(--ink)]">
        {t("idea.statsTitle")}
      </h3>
      <div className="space-y-2.5 text-[13px]">
        {primary.map(([label, count]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-[var(--ink-soft)]">{label}</span>
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      {secondary.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-[var(--divider)] pt-3 text-[11px]">
          {secondary.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-[var(--ink-faint)]">{label}</span>
              <span className="tabular-nums text-[var(--ink-faint)]">{count}</span>
            </div>
          ))}
        </div>
      )}
      {stats && stats.version_stats.length > 1 && (
        <div className="mt-4 border-t border-[var(--divider)] pt-3">
          <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
            {t("idea.versionInteractions")}
          </p>
          <div className="space-y-1.5">
            {stats.version_stats.map((row) => (
              <div
                key={row.version_id}
                className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]"
              >
                <span>v{row.version}</span>
                <span className="tabular-nums">
                  {t("idea.forkCountShort", { count: row.stats.fork_count })} · {t("idea.statComments")} {row.stats.comment_count} ·{" "}
                  {t("idea.statFlowers")} {row.stats.flower_count} · {t("idea.statReactions")}{" "}
                  {row.stats.reaction_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
