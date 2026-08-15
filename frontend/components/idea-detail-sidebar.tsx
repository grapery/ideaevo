"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlowerSender, Idea, IdeaStats } from "@/lib/types";
import { SendFlowerButton } from "./idea-action-bar";
import { WireframeAvatar } from "./wireframe-avatar";
import { Modal } from "./ui/modal";
import { getApiBase } from "@/lib/api-base";
import { DeimosIcon } from "./deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

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
  // 当前名单对应的计数,送花后(flowerCount 变化)触发重取
  const [loadedCount, setLoadedCount] = useState(flowerCount);

  useEffect(() => {
    // 服务端已预取送花名单(initialSenders)且计数未变化时,不再重复请求
    if (initialSenders.length > 0 && flowerCount === loadedCount && retryToken === 0) return;
    let cancelled = false;
    fetch(`${getApiBase()}/ideas/${ideaId}/flowers`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("flowers fetch failed");
        return r.json();
      })
      .then((data) => {
        // 后端字段仍为 donors，前端按送花者展示
        if (!cancelled) {
          setSenders(data.donors || []);
          setLoadedCount(flowerCount);
        }
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
  }, [ideaId, flowerCount, initialSenders.length, retryToken, loadedCount]);

  const displaySenders = senders.slice(0, 12);
  const hiddenCount = Math.max(0, senders.length - displaySenders.length);
  const canExpand = senders.length > 0;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--primary-border)] bg-[var(--primary-soft)] p-4 text-[var(--primary-ink)]">
      <h3 className="mb-3 border-b border-[var(--primary-border)] pb-2 text-[12px] font-semibold">
        <DeimosIcon name="flower" className="mr-1 inline-block h-3.5 w-3.5 text-[var(--primary)]" />
        {t("idea.flowerSignals")} / {t("idea.flowerCountLabel", { count: flowerCount })}
      </h3>
      {!loaded ? (
        <p className="mb-2.5 text-sm text-[var(--ink-faint)]">{t("common.loading")}</p>
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
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-2 text-xs tabular-nums text-[var(--ink-faint)]">
              +{hiddenCount}
            </span>
          )}
        </button>
      ) : loadFailed ? (
        <div className="mb-2.5">
          <p className="text-sm text-[var(--ink-faint)]">{t("idea.flowerLoadFailed")}</p>
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
        <p className="mb-2.5 text-sm text-[var(--ink-faint)]">{t("idea.flowerUnavailable")}</p>
      ) : (
        <p className="mb-2.5 text-sm text-[var(--ink-faint)]">{t("idea.noFlowers")}</p>
      )}
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
                    <div className="truncate text-sm font-medium text-[var(--ink)]">
                      {sender.name}
                    </div>
                    <div className="text-xs text-[var(--ink-faint)]">
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
    <div className="surface-card p-4">
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
          <p className="mb-2 text-xs font-medium text-[var(--ink-faint)]">
            {t("idea.versionInteractions")}
          </p>
          <div className="space-y-1.5">
            {stats.version_stats.map((row) => (
              <div
                key={row.version_id}
                className="flex items-center justify-between gap-2 text-xs text-[var(--ink-faint)]"
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
