"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Idea, IdeaLineage } from "@/lib/types";
import { getApiBase } from "@/lib/api-base";
import { IconGitFork } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

/** 一个图节点（祖先 / 当前 / fork 后代）。kind 决定渲染样式。 */
interface FlowNode {
  id: string;
  title: string;
  agentName?: string;
  agentAvatar?: string;
  reason?: string;
  createdAt?: string;
  status?: string;
  kind: "ancestor" | "current" | "fork";
  children: FlowNode[];
}

/** 图中的一行（最旧在最上方）。lane 决定横向位置。 */
interface LayoutRow {
  node: FlowNode;
  lane: number;
  lanesAbove: number[];
  lanesBelow: number[];
  branchFrom?: number;
}

const LANE_W = 22;
const ROW_H = 52;
const PAD_X = 14;
const PAD_Y = 6;
const DOT_R = 4.5;
const CURVE_R = 10;

const LANE_COLORS = [
  "#57606a",
  "#0969da",
  "#8250df",
  "#1a7f37",
  "#bf8700",
  "#cf222e",
  "#0550ae",
];

function laneX(lane: number) {
  return PAD_X + lane * LANE_W;
}

function ideaToNode(idea: Idea, kind: FlowNode["kind"]): FlowNode {
  return {
    id: idea.id,
    title: idea.title,
    agentName: idea.agent?.name,
    agentAvatar: idea.agent?.avatar_url,
    reason: idea.description ? idea.description.split("\n")[0].slice(0, 100) : undefined,
    createdAt: idea.created_at,
    status: idea.status,
    kind,
    children: [],
  };
}

/**
 * GitHub network / `git log --graph` 风格：
 * 主链（祖先 + HEAD）始终在 lane 0；fork 后代向右分支到独立 lane。
 */
function layoutGitGraph(
  ancestors: FlowNode[],
  current: FlowNode,
  descendants: FlowNode[]
): LayoutRow[] {
  const rows: LayoutRow[] = [];
  const activeBelow = new Set<number>();

  const pushRow = (partial: Omit<LayoutRow, "lanesAbove" | "lanesBelow">) => {
    const lanesAbove = [...activeBelow];
    rows.push({ ...partial, lanesAbove, lanesBelow: [] });
    return rows.length - 1;
  };

  const setBelow = (idx: number, lanes: number[]) => {
    rows[idx].lanesBelow = lanes;
    activeBelow.clear();
    lanes.forEach((l) => activeBelow.add(l));
  };

  ancestors.forEach((a, i) => {
    const idx = pushRow({ node: a, lane: 0 });
    // 主链继续到下一个祖先或 HEAD
    setBelow(idx, [0]);
    void i;
  });

  const headIdx = pushRow({ node: current, lane: 0 });

  if (descendants.length === 0) {
    setBelow(headIdx, []);
    return rows;
  }

  // 主链 lane 0 保持到最后一个 fork，便于兄弟分支都从 HEAD 平滑分出
  const childLanes = descendants.map((_, i) => i + 1);
  setBelow(headIdx, [0, childLanes[0]]);

  descendants.forEach((node, i) => {
    const lane = childLanes[i];
    const idx = pushRow({
      node,
      lane,
      branchFrom: 0,
    });
    if (i < descendants.length - 1) {
      setBelow(idx, [0, childLanes[i + 1]]);
    } else {
      setBelow(idx, []);
    }
  });

  return rows;
}

function maxLaneOf(rows: LayoutRow[]) {
  let m = 0;
  for (const r of rows) {
    m = Math.max(m, r.lane, ...r.lanesAbove, ...r.lanesBelow);
  }
  return m;
}

function GitGraphSvg({ rows }: { rows: LayoutRow[] }) {
  const maxLane = maxLaneOf(rows);
  const width = Math.max(laneX(maxLane) + PAD_X, LANE_W + PAD_X * 2);
  const height = rows.length * ROW_H + PAD_Y * 2;

  const paths: ReactNode[] = [];
  const dots: ReactNode[] = [];

  rows.forEach((row, i) => {
    const yMid = i * ROW_H + ROW_H / 2 + PAD_Y;
    const x = laneX(row.lane);
    const color = LANE_COLORS[row.lane % LANE_COLORS.length];
    const isCurrent = row.node.kind === "current";
    const isImplemented = row.node.status === "implemented";
    const nodeColor = isImplemented ? "#1a7f37" : isCurrent ? "#0969da" : color;

    if (i > 0) {
      const prev = rows[i - 1];
      const yTop = (i - 1) * ROW_H + ROW_H / 2 + PAD_Y;

      if (row.branchFrom !== undefined && row.lane !== row.branchFrom) {
        const bx = laneX(row.branchFrom);
        const yTurn = yMid - CURVE_R;
        const dx = x - bx;
        paths.push(
          <path
            key={`branch-${i}`}
            d={`M ${bx} ${yTop} L ${bx} ${yTurn} Q ${bx} ${yMid} ${bx + dx / 2} ${yMid} L ${x} ${yMid}`}
            fill="none"
            stroke={nodeColor}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
        for (const la of row.lanesAbove) {
          if (la === row.branchFrom || la === row.lane) continue;
          if (!prev.lanesBelow.includes(la)) continue;
          const lx = laneX(la);
          paths.push(
            <line
              key={`v-pass-${i}-${la}`}
              x1={lx}
              y1={yTop}
              x2={lx}
              y2={yMid}
              stroke={LANE_COLORS[la % LANE_COLORS.length]}
              strokeWidth={1.25}
              opacity={0.45}
            />
          );
        }
      } else {
        for (const la of row.lanesAbove) {
          if (!prev.lanesBelow.includes(la)) continue;
          const lx = laneX(la);
          paths.push(
            <line
              key={`v-straight-${i}-${la}`}
              x1={lx}
              y1={yTop}
              x2={lx}
              y2={yMid}
              stroke={la === row.lane ? nodeColor : LANE_COLORS[la % LANE_COLORS.length]}
              strokeWidth={la === row.lane ? 1.5 : 1.25}
              opacity={la === row.lane ? 0.95 : 0.45}
            />
          );
        }
      }
    }

    if (i < rows.length - 1) {
      const yNext = (i + 1) * ROW_H + ROW_H / 2 + PAD_Y;
      for (const lb of row.lanesBelow) {
        if (lb === row.lane) continue;
        const next = rows[i + 1];
        // 下一行节点就在该 lane 上时，由「上一行→本行」那段接线，避免重复
        if (next.lane === lb) continue;
        const lx = laneX(lb);
        paths.push(
          <line
            key={`v-pass-below-${i}-${lb}`}
            x1={lx}
            y1={yMid}
            x2={lx}
            y2={yNext}
            stroke={LANE_COLORS[lb % LANE_COLORS.length]}
            strokeWidth={1.25}
            opacity={0.45}
          />
        );
      }
    }

    if (isCurrent) {
      dots.push(
        <g key={`dot-${i}`}>
          <circle cx={x} cy={yMid} r={DOT_R + 1.5} fill={nodeColor} />
          <circle cx={x} cy={yMid} r={2} fill="#fff" />
        </g>
      );
    } else {
      dots.push(
        <circle
          key={`dot-${i}`}
          cx={x}
          cy={yMid}
          r={DOT_R}
          fill={isImplemented ? nodeColor : "#fff"}
          stroke={nodeColor}
          strokeWidth={1.5}
        />
      );
    }
  });

  return (
    <svg
      width={width}
      height={height}
      className="shrink-0"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {paths}
      {dots}
    </svg>
  );
}

function relativeTime(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  const isZh = locale.startsWith("zh");
  if (min < 1) return isZh ? "刚刚" : "just now";
  if (min < 60) return isZh ? `${min} 分钟前` : `${min}m ago`;
  if (hr < 24) return isZh ? `${hr} 小时前` : `${hr}h ago`;
  if (day < 30) return isZh ? `${day} 天前` : `${day}d ago`;
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(
  status: string | undefined,
  t: (key: TranslationKey) => string
): string | null {
  if (status === "implemented") return t("idea.implemented");
  if (status === "archived") return t("market.archived");
  if (status === "buried") return t("market.buried");
  if (status === "active") return null;
  return null;
}

function AgentAvatar({ name, url, color }: { name?: string; url?: string; color: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name || ""}
        className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-[var(--rule)]"
      />
    );
  }
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {initial}
    </span>
  );
}

function RowContent({
  row,
}: {
  row: LayoutRow;
}) {
  const { locale, t } = useI18n();
  const isCurrent = row.node.kind === "current";
  const isAncestor = row.node.kind === "ancestor";
  const color = LANE_COLORS[row.lane % LANE_COLORS.length];
  const status = statusLabel(row.node.status, t);

  return (
    <div
      className={`group flex min-w-0 flex-1 items-center gap-3 border-b border-[var(--rule)] px-2 transition-colors last:border-b-0 hover:bg-[var(--bg-subtle)] ${
        isCurrent ? "bg-[color-mix(in_srgb,var(--accent-link)_6%,transparent)]" : ""
      }`}
      style={{ minHeight: ROW_H }}
    >
      <div className="min-w-0 flex-1 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {isCurrent ? (
            <span className="truncate text-[13px] font-semibold text-[var(--ink)]">
              {row.node.title}
            </span>
          ) : (
            <Link
              href={`/ideas/${row.node.id}`}
              className="truncate text-[13px] font-medium text-[var(--ink)] hover:text-[var(--accent-link)] hover:underline"
            >
              {row.node.title}
            </Link>
          )}
          {isCurrent && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#0969da]/30 bg-[#ddf4ff] px-1.5 py-px text-[10px] font-semibold text-[#0969da]">
              HEAD
            </span>
          )}
          {isAncestor && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--rule)] px-1.5 py-px text-[10px] text-[var(--ink-faint)]">
              {t("idea.ancestor")}
            </span>
          )}
          {row.node.kind === "fork" && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--rule)] px-1.5 py-px text-[10px] text-[var(--ink-faint)]">
              <IconGitFork className="h-2.5 w-2.5" />
              fork
            </span>
          )}
          {status && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#1a7f37]/25 bg-[#dafbe1] px-1.5 py-px text-[10px] font-medium text-[#1a7f37]">
              {status}
            </span>
          )}
        </div>
        {row.node.reason && (
          <p className="mt-0.5 truncate text-[12px] text-[var(--ink-soft)]">
            {row.node.reason}
          </p>
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {(row.node.agentName || row.node.agentAvatar) && (
          <div className="flex max-w-[140px] items-center gap-1.5 text-[12px] text-[var(--ink-faint)]">
            <AgentAvatar name={row.node.agentName} url={row.node.agentAvatar} color={color} />
            <span className="truncate">{row.node.agentName}</span>
          </div>
        )}
        {row.node.createdAt && (
          <time
            className="w-[72px] text-right font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--ink-faint)]"
            dateTime={row.node.createdAt}
            title={new Date(row.node.createdAt).toLocaleString(locale)}
          >
            {relativeTime(row.node.createdAt, locale)}
          </time>
        )}
      </div>
    </div>
  );
}

const ancestorCache = new Map<string, FlowNode[]>();

async function fetchAncestorChain(idea: Idea, apiBase: string): Promise<FlowNode[]> {
  if (ancestorCache.has(idea.id)) return ancestorCache.get(idea.id)!;

  const ancestors: FlowNode[] = [];
  let parentId = idea.forked_from_id;
  let depth = 0;

  while (parentId && depth < 20) {
    try {
      const res = await fetch(`${apiBase}/ideas/${parentId}`);
      if (!res.ok) break;
      const parent: Idea = await res.json();
      ancestors.unshift({
        id: parent.id,
        title: parent.title,
        agentName: parent.agent?.name,
        agentAvatar: parent.agent?.avatar_url,
        reason: parent.description
          ? parent.description.split("\n")[0].slice(0, 100)
          : undefined,
        createdAt: parent.created_at,
        status: parent.status,
        kind: "ancestor",
        children: [],
      });
      parentId = parent.forked_from_id;
      depth++;
    } catch {
      break;
    }
  }

  ancestorCache.set(idea.id, ancestors);
  return ancestors;
}

export function ForkFlowGraph({
  idea,
  lineage,
  children: forkChildren,
}: {
  idea: Idea;
  lineage: IdeaLineage | null;
  children: Idea[];
}) {
  const [ancestors, setAncestors] = useState<FlowNode[]>([]);
  const [loading, setLoading] = useState(true);
  const apiBase = getApiBase();
  const { t } = useI18n();
  const isFetched = useRef(false);

  useEffect(() => {
    if (isFetched.current) return;
    isFetched.current = true;

    const sourceIdea = lineage?.source_idea;
    if (sourceIdea) {
      const directParent: FlowNode = {
        id: sourceIdea.id,
        title: sourceIdea.title,
        agentName: sourceIdea.agent?.name,
        agentAvatar: sourceIdea.agent?.avatar_url,
        reason: sourceIdea.description
          ? sourceIdea.description.split("\n")[0].slice(0, 100)
          : undefined,
        createdAt: sourceIdea.created_at,
        status: sourceIdea.status,
        kind: "ancestor",
        children: [],
      };

      if (sourceIdea.forked_from_id) {
        fetchAncestorChain(sourceIdea, apiBase).then((grandchain) => {
          setAncestors([...grandchain, directParent]);
          setLoading(false);
        });
      } else {
        setAncestors([directParent]);
        setLoading(false);
      }
    } else if (idea.forked_from_id) {
      fetchAncestorChain(idea, apiBase).then((chain) => {
        setAncestors(chain);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [idea, lineage, apiBase]);

  const descendants = useMemo<FlowNode[]>(
    () => forkChildren.map((c) => ideaToNode(c, "fork")),
    [forkChildren]
  );

  const currentNode = useMemo<FlowNode>(
    () => ({
      id: idea.id,
      title: idea.title,
      agentName: idea.agent?.name,
      agentAvatar: idea.agent?.avatar_url,
      reason: idea.description ? idea.description.split("\n")[0].slice(0, 100) : undefined,
      createdAt: idea.created_at,
      status: idea.status,
      kind: "current",
      children: descendants,
    }),
    [idea, descendants]
  );

  const layout = useMemo(
    () => layoutGitGraph(ancestors, currentNode, descendants),
    [ancestors, currentNode, descendants]
  );

  const hasLineage = ancestors.length > 0 || forkChildren.length > 0;
  const totalForks = lineage?.stats.total_forks ?? idea.fork_count;
  const activeBranches =
    lineage?.stats.active_branches ??
    forkChildren.filter((c) => c.status === "active").length;
  const contributors = lineage?.stats.contributors ?? 0;

  return (
    <section id="evolution" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">
            {t("idea.forkNetwork")}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            {t("idea.forkNetworkHint")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--ink-faint)]">
          <span>{t("idea.totalForks", { count: totalForks })}</span>
          <span>{t("idea.activeBranches", { count: activeBranches })}</span>
          <span>{t("idea.contributors", { count: contributors })}</span>
          {ancestors.length > 0 && (
            <span>{t("idea.upstreamLayers", { count: ancestors.length })}</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden surface-card">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--rule)] bg-[var(--bg-subtle)] px-4 py-2">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-soft)]">
            <IconGitFork className="h-3.5 w-3.5 shrink-0" />
            {t("idea.forkLineageShort")}
          </h3>
          <div className="hidden items-center gap-4 text-[11px] text-[var(--ink-faint)] sm:flex">
            <span className="w-[140px]">{t("idea.publisher")}</span>
            <span className="w-[72px] text-right">{t("idea.updated")}</span>
          </div>
        </div>

        {hasLineage ? (
          <div className="overflow-x-auto">
            <div className="flex min-w-[320px]">
              <div className="shrink-0 border-r border-[var(--rule)] bg-[var(--bg-subtle)]/40 py-0 pl-1">
                <GitGraphSvg rows={layout} />
              </div>
              <div className="min-w-0 flex-1">
                {layout.map((row) => (
                  <RowContent key={row.node.id} row={row} />
                ))}
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="px-4 py-12 text-center text-[13px] text-[var(--ink-faint)]">
            {t("common.loading")}
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <IconGitFork className="mb-3 h-8 w-8 text-[var(--ink-faint)]" />
            <p className="text-[13px] font-medium text-[var(--ink-soft)]">
              {t("idea.noForkRecords")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#0969da]">
            <span className="h-1 w-1 rounded-full bg-white" />
          </span>
          {t("idea.currentBranch")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-[#57606a] bg-white" />
          {t("idea.ancestor")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1a7f37]" />
          {t("idea.implemented")}
        </span>
      </div>
    </section>
  );
}
