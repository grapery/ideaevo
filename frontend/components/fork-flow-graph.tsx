"use client";

import { useEffect, useMemo, useState } from "react";
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

interface GraphRow {
  node: FlowNode;
  depth: number;
  lane: number;
  maxLane: number;
  isLastSibling: boolean;
  parentLane: number;
  ancestorChain: number[];
}

const LANE_COLORS = [
  "var(--primary)",
  "#6b8cae",
  "#9b7bb8",
  "#c49a6c",
  "#7ba38f",
];

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "今天";
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
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

  const directForks = childrenByParent.get(ideaId) || [];
  return directForks
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(toNode);
}

function flattenTree(
  nodes: FlowNode[],
  depth: number,
  lane: number,
  parentLane: number,
  ancestorChain: number[],
  isLastSibling: boolean
): GraphRow[] {
  const rows: GraphRow[] = [];
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const nodeLane = depth === 0 ? 0 : lane;
    rows.push({
      node,
      depth,
      lane: nodeLane,
      maxLane: nodeLane,
      isLastSibling: isLast,
      parentLane,
      ancestorChain: [...ancestorChain],
    });

    if (node.children.length > 0) {
      const childRows = flattenTree(
        node.children,
        depth + 1,
        nodeLane + 1,
        nodeLane,
        [...ancestorChain, nodeLane],
        isLast
      );
      rows.push(...childRows);
      const maxChildLane = childRows.reduce((m, r) => Math.max(m, r.lane), nodeLane);
      rows[rows.length - childRows.length - 1].maxLane = maxChildLane;
    }
  });
  return rows;
}

function GraphGutter({
  row,
  isFirst,
  isLast,
  hasNext,
}: {
  row: GraphRow;
  isFirst: boolean;
  isLast: boolean;
  hasNext: boolean;
}) {
  const laneWidth = 14;
  const dotX = 7;
  const color = LANE_COLORS[row.lane % LANE_COLORS.length];
  const isCurrent = row.node.kind === "current";

  return (
    <div className="relative w-[28px] shrink-0" style={{ minHeight: 48 }}>
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        {/* Main vertical line (ancestors + current) */}
        {row.node.kind !== "fork" && !isLast && (
          <line
            x1={dotX}
            y1={isCurrent ? 14 : 0}
            x2={dotX}
            y2="100%"
            stroke="var(--divider)"
            strokeWidth={2}
          />
        )}

        {/* Ancestor line from top */}
        {row.node.kind === "ancestor" && !isFirst && (
          <line
            x1={dotX}
            y1={0}
            x2={dotX}
            y2={14}
            stroke="var(--divider)"
            strokeWidth={2}
          />
        )}

        {/* Fork branch lines */}
        {row.node.kind === "fork" && (
          <>
            {/* Vertical from parent lane */}
            {row.ancestorChain.map((lane, i) => {
              const x = dotX + lane * laneWidth;
              const showVert = !row.isLastSibling || i < row.ancestorChain.length - 1;
              if (!showVert && row.isLastSibling) return null;
              return (
                <line
                  key={`v-${lane}-${i}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={row.isLastSibling && i === row.ancestorChain.length - 1 ? 14 : "100%"}
                  stroke={LANE_COLORS[lane % LANE_COLORS.length]}
                  strokeWidth={2}
                  opacity={0.5}
                />
              );
            })}
            {/* Horizontal connector */}
            <path
              d={`M ${dotX} 14 L ${dotX + row.depth * laneWidth} 14`}
              stroke={color}
              strokeWidth={2}
              fill="none"
              opacity={0.7}
            />
            {/* Vertical down if has children or not last */}
            {(hasNext || row.node.children.length > 0) && !row.isLastSibling && (
              <line
                x1={dotX + row.depth * laneWidth}
                y1={14}
                x2={dotX + row.depth * laneWidth}
                y2="100%"
                stroke={color}
                strokeWidth={2}
                opacity={0.5}
              />
            )}
          </>
        )}

        {/* Fork point from current to children */}
        {row.node.kind === "current" && row.node.children.length > 0 && (
          <line
            x1={dotX}
            y1={14}
            x2={dotX}
            y2="100%"
            stroke="var(--divider)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Node dot */}
      <div
        className="absolute left-0 top-[6px] flex items-center justify-center"
        style={{ left: row.node.kind === "fork" ? row.depth * laneWidth : 0 }}
      >
        {isCurrent ? (
          <div
            className="flex h-[14px] w-[14px] items-center justify-center rounded-full border-2"
            style={{ borderColor: color, background: color }}
          >
            <div className="h-[5px] w-[5px] rounded-full bg-white" />
          </div>
        ) : (
          <div
            className="h-[10px] w-[10px] rounded-full border-2 bg-[var(--bg-surface)]"
            style={{ borderColor: row.node.kind === "fork" ? color : "var(--divider)" }}
          />
        )}
      </div>
    </div>
  );
}

function FlowRow({
  row,
  isFirst,
  isLast,
  hasNext,
}: {
  row: GraphRow;
  isFirst: boolean;
  isLast: boolean;
  hasNext: boolean;
}) {
  const isCurrent = row.node.kind === "current";
  const color = LANE_COLORS[row.lane % LANE_COLORS.length];

  return (
    <div className="flex gap-2 py-1">
      <GraphGutter row={row} isFirst={isFirst} isLast={isLast} hasNext={hasNext} />
      <div
        className={`min-w-0 flex-1 rounded-lg px-2.5 py-1.5 ${
          isCurrent
            ? "bg-[var(--primary-soft)] ring-1 ring-[var(--primary)]/20"
            : "hover:bg-[var(--bg-subtle)]"
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {isCurrent ? (
              <span className="block truncate text-sm font-medium text-[var(--primary)]">
                {row.node.title}
              </span>
            ) : (
              <Link
                href={`/ideas/${row.node.id}`}
                className="block truncate text-sm text-[var(--text-secondary)] hover:text-[var(--primary)]"
              >
                {row.node.title}
              </Link>
            )}
            {isCurrent && (
              <span
                className="mt-0.5 inline-block rounded px-1.5 py-px text-[10px] font-medium"
                style={{ background: color, color: "white" }}
              >
                HEAD
              </span>
            )}
            {row.node.kind === "fork" && row.node.reason && (
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                {row.node.reason}
              </p>
            )}
            {row.node.kind === "fork" && row.node.createdAt && (
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {row.node.agentId && (
                  <span>Agent {row.node.agentId.slice(0, 6)} · </span>
                )}
                {formatRelative(row.node.createdAt)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchAncestorChain(
  idea: Idea,
  apiBase: string
): Promise<FlowNode[]> {
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

  const rows: GraphRow[] = useMemo(() => {
    const result: GraphRow[] = [];

    ancestors.forEach((a, i) => {
      result.push({
        node: a,
        depth: 0,
        lane: 0,
        maxLane: 0,
        isLastSibling: i === ancestors.length - 1 && descendants.length === 0,
        parentLane: 0,
        ancestorChain: [],
      });
    });

    result.push({
      node: {
        id: idea.id,
        title: idea.title,
        kind: "current",
        children: descendants,
      },
      depth: 0,
      lane: 0,
      maxLane: 0,
      isLastSibling: descendants.length === 0,
      parentLane: 0,
      ancestorChain: [],
    });

    if (descendants.length > 0) {
      const forkRows = flattenTree(descendants, 1, 1, 0, [0], descendants.length === 1);
      result.push(...forkRows);
    }

    return result;
  }, [ancestors, idea.id, idea.title, descendants]);

  const hasLineage = ancestors.length > 0 || forks.length > 0;

  if (!hasLineage && compact) return null;

  return (
    <div className={compact ? "" : "surface-card p-5"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3
          className={`heading-sans text-sm flex items-center gap-1.5 ${
            compact ? "" : "pb-2 mb-0 border-b border-[var(--divider)]"
          }`}
        >
          <IconGitFork className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          Fork 谱系
        </h3>
        <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
          {forks.length} 个衍生
          {ancestors.length > 0 && ` · ${ancestors.length} 层上游`}
        </span>
      </div>

      {hasLineage ? (
        <div className="overflow-x-auto">
          <div className="min-w-[200px]">
            {rows.map((row, i) => (
              <FlowRow
                key={row.node.id}
                row={row}
                isFirst={i === 0}
                isLast={i === rows.length - 1}
                hasNext={i < rows.length - 1}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          暂无 Fork 记录，成为第一个衍生者
        </p>
      )}
    </div>
  );
}
