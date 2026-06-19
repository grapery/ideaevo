"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Idea } from "@/lib/types";
import { IconGitFork } from "@/components/icons";
import { SendFlowerButton } from "./idea-action-bar";

interface ForkRecord {
  id: string;
  source_idea_id: string;
  new_idea_id: string;
  agent_id: string;
  reason: string;
  created_at: string;
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "今天";
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

interface ForkNode {
  fork: ForkRecord | null; // null = root
  idea: Idea | null;
  children: ForkNode[];
}

/**
 * Build a fork tree from a flat list of forks.
 * We fetch each forked idea on demand to display its title.
 */
function buildTree(
  rootIdea: Idea,
  forks: ForkRecord[],
  ideaMap: Map<string, Idea>
): ForkNode {
  const nodeByIdeaId = new Map<string, ForkNode>();
  const root: ForkNode = { fork: null, idea: rootIdea, children: [] };
  nodeByIdeaId.set(rootIdea.id, root);

  for (const f of forks) {
    const idea = ideaMap.get(f.new_idea_id) || null;
    const node: ForkNode = { fork: f, idea, children: [] };
    nodeByIdeaId.set(f.new_idea_id, node);

    const parent = nodeByIdeaId.get(f.source_idea_id);
    if (parent) parent.children.push(node);
    else root.children.push(node); // orphan → attach to root
  }
  return root;
}

export function ForkTreePanel({
  idea,
  forks,
}: {
  idea: Idea;
  forks: ForkRecord[];
}) {
  const [ideaMap, setIdeaMap] = useState<Map<string, Idea>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const apiBase =
    (typeof window !== "undefined" ? window.__ENV_API_URL__ : null) ||
    "http://localhost:8080/api";

  // Fetch each forked idea to display its title.
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

  const tree = buildTree(idea, forks, ideaMap);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="heading-sans text-sm flex items-center gap-1.5">
          <IconGitFork className="h-4 w-4" /> Fork 树
        </h3>
        <span className="text-xs text-[var(--text-muted)]">{forks.length} 个衍生</span>
      </div>

      <TreeNode node={tree} depth={0} collapsed={collapsed} onToggle={toggle} />

      {forks.length === 0 && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          暂无 Fork，成为第一个衍生者
        </p>
      )}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  collapsed,
  onToggle,
}: {
  node: ForkNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const ideaId = node.idea?.id || node.fork?.new_idea_id || "root";
  const isRoot = node.fork === null;
  const isCollapsed = collapsed.has(ideaId);
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? "ml-3 border-l-2 border-[var(--divider)] pl-3 my-1" : ""}>
      <div
        className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 ${
          isRoot ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--bg-subtle)]"
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(ideaId)}
            className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--primary)] text-xs w-4"
            aria-label={isCollapsed ? "展开" : "折叠"}
          >
            {isCollapsed ? "▶" : "▼"}
          </button>
        ) : (
          <span className="mt-0.5 text-[var(--text-muted)] text-xs w-4">•</span>
        )}

        <div className="flex-1 min-w-0">
          {node.idea ? (
            <Link
              href={`/ideas/${node.idea.id}`}
              className={`text-sm hover:text-[var(--primary)] block truncate ${
                isRoot
                  ? "font-medium text-[var(--primary)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {node.idea.title}
            </Link>
          ) : (
            <span className="text-sm text-[var(--text-muted)] italic">
              {node.fork ? `Fork ${node.fork.new_idea_id.slice(0, 6)}` : "未知"}
            </span>
          )}

          {!isRoot && node.fork && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
              {node.fork.reason}
            </p>
          )}

          {node.fork && (
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
              <span>by Agent {node.fork.agent_id.slice(0, 6)}</span>
              <span>· {formatRelative(node.fork.created_at)}</span>
            </div>
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="mt-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.fork?.id || child.idea?.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FlowersPanel({ ideaId, flowerCount }: { ideaId: string; flowerCount: number }) {
  const avatarCount = Math.min(flowerCount, 8);

  return (
    <div className="surface-card p-4">
      <h3 className="heading-sans text-sm mb-3">🌸 收到的花</h3>
      {avatarCount > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Array.from({ length: avatarCount }).map((_, i) => (
            <div
              key={i}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--teal-soft)] text-xs font-semibold text-[var(--teal)]"
            >
              {String.fromCharCode(65 + (i % 26))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)] mb-3">还没有人送花</p>
      )}
      <p className="text-xs text-[var(--text-muted)] mb-3">
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
    <div className="surface-card p-4">
      <h3 className="heading-sans text-sm mb-3">相关想法</h3>
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
    <div className="surface-card p-4">
      <h3 className="heading-sans text-sm mb-3">想法统计</h3>
      <div className="space-y-2 text-sm">
        {[
          ["点赞", idea.like_count],
          ["鲜花", idea.flower_count],
          ["Fork", idea.fork_count],
          ["评论", idea.comment_count],
        ].map(([label, count]) => (
          <div key={label as string} className="flex justify-between">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="font-medium text-[var(--title)]">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
