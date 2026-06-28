"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Idea } from "@/lib/types";
import { getApiBase } from "@/lib/api-base";
import { IconGitFork } from "@/components/icons";

interface ForkRecord {
  id: string;
  source_idea_id: string;
  new_idea_id: string;
  agent_id: string;
  reason: string;
  created_at: string;
}

interface FlowNode {
  id: string;
  title: string;
  agentId?: string;
  reason?: string;
  createdAt?: string;
  kind: "ancestor" | "current" | "fork";
  children: FlowNode[];
}

/** One row in the git-style graph (top = oldest) */
interface LayoutRow {
  node: FlowNode;
  lane: number;
  /** Lanes that carry a vertical line through the top half of this row */
  lanesAbove: number[];
  /** Lanes that carry a vertical line through the bottom half of this row */
  lanesBelow: number[];
  /** Draw a branch elbow from lanesAbove[branchFrom] into this row's lane */
  branchFrom?: number;
}

const LANE_W = 14;
const ROW_H = 48;
const PAD_X = 10;
const DOT_R = 4;

const LANE_COLORS = [
  "var(--ink-faint)",
  "var(--accent-link)",
  "#6b8cae",
  "#9b7bb8",
  "#c49a6c",
];

function laneX(lane: number) {
  return PAD_X + lane * LANE_W;
}

function buildDescendantTree(
  ideaId: string,
  forks: ForkRecord[],
  ideaMap: Map<string, Idea>
): FlowNode[] {
  const childrenByParent = new Map<string, ForkRecord[]>();
  for (const f of forks) {
    const list = childrenByParent.get(f.source_idea_id) || [];
    list.push(f);
    childrenByParent.set(f.source_idea_id, list);
  }

  function toNode(fork: ForkRecord): FlowNode {
    const idea = ideaMap.get(fork.new_idea_id);
    const childForks = childrenByParent.get(fork.new_idea_id) || [];
    return {
      id: fork.new_idea_id,
      title: idea?.title || `Fork ${fork.new_idea_id.slice(0, 6)}`,
      agentId: fork.agent_id,
      reason: fork.reason,
      createdAt: fork.created_at,
      kind: "fork",
      children: childForks
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(toNode),
    };
  }

  return (childrenByParent.get(ideaId) || [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(toNode);
}

/**
 * Git log --graph style layout.
 * Main lineage (ancestors + HEAD) stays on lane 0; each fork branch gets its own lane.
 */
function layoutGitGraph(
  ancestors: FlowNode[],
  current: FlowNode,
  descendants: FlowNode[]
): LayoutRow[] {
  const rows: LayoutRow[] = [];
  const activeBelow = new Set<number>([0]);

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

  // Ancestors on main lane 0
  ancestors.forEach((a, i) => {
    const idx = pushRow({ node: a, lane: 0 });
    const hasMore = i < ancestors.length - 1 || ancestors.length > 0;
    setBelow(idx, hasMore ? [0] : []);
  });

  // HEAD — fork tip: branches off lane 0 when forked from ancestor
  const headLane = ancestors.length > 0 ? 1 : 0;
  const headIdx = pushRow({
    node: current,
    lane: headLane,
    branchFrom: ancestors.length > 0 ? 0 : undefined,
  });

  if (descendants.length === 0) {
    setBelow(headIdx, ancestors.length > 0 ? [0] : []);
    return rows;
  }

  // Fork point from HEAD: keep main lane 0 + child lanes
  const childLanes = descendants.map((_, i) => i + (headLane + 1));
  setBelow(headIdx, [0, ...childLanes]);

  function walkChildren(nodes: FlowNode[], lanes: number[], parentLane: number) {
    nodes.forEach((node, i) => {
      const lane = lanes[i];
      const idx = pushRow({
        node,
        lane,
        branchFrom: parentLane,
      });

      if (node.children.length > 0) {
        // Nested forks continue on same lane, children branch further right
        const nestedLanes = node.children.map((_, j) => lane + j + 1);
        const below = [parentLane, lane, ...nestedLanes];
        setBelow(idx, [...new Set(below)]);
        walkChildren(node.children, nestedLanes, lane);
      } else {
        // Close this branch lane; keep parent lanes if siblings remain
        const remaining = lanes.slice(i + 1);
        const below = [parentLane, ...remaining];
        setBelow(idx, below.length > 0 ? [...new Set(below)] : []);
      }
    });
  }

  walkChildren(descendants, childLanes, headLane);
  return rows;
}

function maxLaneOf(rows: LayoutRow[]) {
  let m = 0;
  for (const r of rows) {
    m = Math.max(m, r.lane, ...r.lanesAbove, ...r.lanesBelow);
  }
  return m;
}

/** Unified SVG for the entire graph column */
function GitGraphSvg({ rows }: { rows: LayoutRow[] }) {
  const maxLane = maxLaneOf(rows);
  const width = laneX(maxLane) + PAD_X;
  const height = rows.length * ROW_H;

  const paths: ReactNode[] = [];
  const dots: ReactNode[] = [];

  rows.forEach((row, i) => {
    const yMid = i * ROW_H + ROW_H / 2;
    const x = laneX(row.lane);
    const color = LANE_COLORS[row.lane % LANE_COLORS.length];
    const isCurrent = row.node.kind === "current";

    // Connect from previous row's dot to this row's dot
    if (i > 0) {
      const prev = rows[i - 1];
      const yTop = (i - 1) * ROW_H + ROW_H / 2;
      const yBranch = yMid - 8;

      if (row.branchFrom !== undefined && row.lane !== row.branchFrom) {
        const bx = laneX(row.branchFrom);
        paths.push(
          <path
            key={`branch-${i}`}
            d={`M ${bx} ${yTop} L ${bx} ${yBranch} L ${x} ${yBranch} L ${x} ${yMid}`}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
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
              strokeWidth={1.5}
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
              stroke={la === row.lane ? color : LANE_COLORS[la % LANE_COLORS.length]}
              strokeWidth={1.5}
              opacity={la === row.lane ? 0.85 : 0.45}
            />
          );
        }
      }
    }

    // Pass-through lanes below this row (no commit on that lane)
    if (i < rows.length - 1) {
      const yBot = yMid;
      const yNext = (i + 1) * ROW_H + ROW_H / 2;
      for (const lb of row.lanesBelow) {
        if (lb === row.lane) continue;
        const lx = laneX(lb);
        paths.push(
          <line
            key={`v-pass-below-${i}-${lb}`}
            x1={lx}
            y1={yBot}
            x2={lx}
            y2={yNext}
            stroke={LANE_COLORS[lb % LANE_COLORS.length]}
            strokeWidth={1.5}
            opacity={0.45}
          />
        );
      }
    }

    // Commit dot
    if (isCurrent) {
      dots.push(
        <g key={`dot-${i}`}>
          <circle cx={x} cy={yMid} r={DOT_R + 1} fill={color} stroke={color} strokeWidth={1.5} />
          <circle cx={x} cy={yMid} r={2} fill="var(--bg-surface)" />
        </g>
      );
    } else {
      dots.push(
        <circle
          key={`dot-${i}`}
          cx={x}
          cy={yMid}
          r={DOT_R}
          fill="var(--bg-surface)"
          stroke={color}
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

function RowContent({ row }: { row: LayoutRow }) {
  const isCurrent = row.node.kind === "current";
  const color = LANE_COLORS[row.lane % LANE_COLORS.length];

  return (
    <div
      className="flex min-w-0 flex-1 items-center"
      style={{ height: ROW_H }}
    >
      <div
        className={`min-w-0 flex-1 px-2 ${
          isCurrent
            ? "border border-[var(--rule)] border-l-[3px] bg-[var(--bg-subtle)] py-1.5"
            : "py-0.5"
        }`}
        style={isCurrent ? { borderLeftColor: color } : undefined}
      >
        {isCurrent ? (
          <span className="block truncate text-[13px] font-medium text-[var(--ink)]">
            {row.node.title}
          </span>
        ) : (
          <Link
            href={`/ideas/${row.node.id}`}
            className="block truncate text-[13px] text-[var(--ink-soft)] hover:text-[var(--accent-link)]"
          >
            {row.node.title}
          </Link>
        )}
        {isCurrent && (
          <span
            className="mt-0.5 inline-block px-1 py-px font-[family-name:var(--font-mono)] text-[9px] font-medium uppercase tracking-wider"
            style={{ color }}
          >
            HEAD
          </span>
        )}
        {row.node.kind === "fork" && row.node.reason && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--ink-faint)]" title={row.node.reason}>
            {row.node.reason}
          </p>
        )}
      </div>
    </div>
  );
}

async function fetchAncestorChain(idea: Idea, apiBase: string): Promise<FlowNode[]> {
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
        kind: "ancestor",
        children: [],
      });
      parentId = parent.forked_from_id;
      depth++;
    } catch {
      break;
    }
  }
  return ancestors;
}

export function ForkFlowGraph({
  idea,
  forks,
  compact = false,
}: {
  idea: Idea;
  forks: ForkRecord[];
  compact?: boolean;
}) {
  const [ideaMap, setIdeaMap] = useState<Map<string, Idea>>(new Map());
  const [ancestors, setAncestors] = useState<FlowNode[]>([]);
  const apiBase = getApiBase();

  useEffect(() => {
    if (forks.length === 0) return;
    const ids = forks.map((f) => f.new_idea_id);
    Promise.all(
      ids.map((id) =>
        fetch(`${apiBase}/ideas/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d ? [id, d] : null))
          .catch(() => null)
      )
    ).then((results) => {
      const m = new Map<string, Idea>();
      for (const r of results) {
        if (r) m.set(r[0] as string, r[1] as Idea);
      }
      setIdeaMap(m);
    });
  }, [forks, apiBase]);

  useEffect(() => {
    fetchAncestorChain(idea, apiBase).then(setAncestors);
  }, [idea, apiBase]);

  const descendants = useMemo(
    () => buildDescendantTree(idea.id, forks, ideaMap),
    [idea.id, forks, ideaMap]
  );

  const currentNode: FlowNode = useMemo(
    () => ({
      id: idea.id,
      title: idea.title,
      kind: "current",
      children: descendants,
    }),
    [idea.id, idea.title, descendants]
  );

  const layout = useMemo(
    () => layoutGitGraph(ancestors, currentNode, descendants),
    [ancestors, currentNode, descendants]
  );

  const hasLineage = ancestors.length > 0 || forks.length > 0;

  if (!hasLineage && compact) return null;

  return (
    <div className={compact ? "" : "surface-card p-4"}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3
          className={`flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)] ${
            compact ? "" : "border-b border-[var(--rule)] pb-2"
          }`}
        >
          <IconGitFork className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
          Fork 谱系
        </h3>
        <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
          {forks.length} 个衍生
          {ancestors.length > 0 && ` · ${ancestors.length} 层上游`}
        </span>
      </div>

      {hasLineage ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[200px]">
            <GitGraphSvg rows={layout} />
            <div className="min-w-0 flex-1">
              {layout.map((row) => (
                <RowContent key={row.node.id} row={row} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[12px] leading-relaxed text-[var(--ink-faint)]">
          暂无 Fork 记录，成为第一个衍生者
        </p>
      )}
    </div>
  );
}
