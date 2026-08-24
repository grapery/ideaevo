"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { safeUrl, type Idea, type ProgressItem } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

function relativeTime(at: string, zh: boolean) {
  const d = new Date(at);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return zh ? "刚刚" : "just now";
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return zh ? `${days} 天前` : `${days}d ago`;
  return d.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
}

function dayKey(at: string) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 已完成条目的证据链接：优先 commit SHA（挂到 idea 仓库），否则 link_url */
function evidenceHref(item: ProgressItem, repoUrl: string | null) {
  if (item.commit_sha) {
    if (repoUrl) return `${repoUrl.replace(/\.git$/, "")}/commit/${item.commit_sha}`;
    return safeUrl(item.link_url || "") || null;
  }
  return safeUrl(item.link_url || "") || null;
}

/**
 * idea 实现进度面板：待办勾选 + 按日期分组的 done list（git 提交式累积）。
 * 访客只读；作者（idea.agent.owner_user_id）可添加/勾选/删除。
 */
export function IdeaProgressPanel({
  idea,
  initialTodos,
  initialDones,
}: {
  idea: Idea;
  initialTodos: ProgressItem[];
  initialDones: ProgressItem[];
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useRouter();

  const [todos, setTodos] = useState<ProgressItem[]>(initialTodos);
  const [dones, setDones] = useState<ProgressItem[]>(initialDones);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // 挂载时刻固定基准：渲染期不允许调用 Date.now（react-compiler 纯性规则）
  const [nowTs] = useState(() => Date.now());

  const canEdit = useMemo(
    () => !!user && idea.agent?.owner_user_id === user.id,
    [user, idea.agent?.owner_user_id],
  );
  const total = todos.length + dones.length;
  const repoUrl = safeUrl(idea.repo_url);
  const zh = locale === "zh-CN";

  // done list 按完成日期分组倒序（组内保持服务端给的完成时间倒序）
  const doneGroups = useMemo(() => {
    const groups: { key: string; items: ProgressItem[] }[] = [];
    for (const item of dones) {
      const key = dayKey(item.done_at || item.created_at);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(item);
      else groups.push({ key, items: [item] });
    }
    return groups;
  }, [dones]);

  const dayLabel = (key: string) => {
    const today = dayKey(new Date(nowTs).toISOString());
    const yesterday = dayKey(new Date(nowTs - 86400000).toISOString());
    if (key === today) return t("idea.progressToday");
    if (key === yesterday) return t("idea.progressYesterday");
    return key;
  };

  // 访客无进度时完全不渲染，作者保留入口（空态 + 输入框）
  if (total === 0 && !canEdit) return null;

  async function handleAdd() {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const view = await api.addProgressItems(idea.id, [{ content, status: "todo" }]);
      setTodos(view.todos);
      setDones(view.dones);
      setDraft("");
      notify.success(t("idea.progressAdded"));
      // 首条待办可能已把 impl_status 升为 in_progress，刷新头部徽章
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(item: ProgressItem) {
    const nextStatus = item.status === "done" ? "todo" : "done";
    // 快照用于失败回滚（整体恢复，保持原顺序）
    const snapTodos = todos;
    const snapDones = dones;
    // 乐观切换
    if (nextStatus === "done") {
      const optimistic = { ...item, status: "done", done_at: new Date().toISOString() };
      setTodos((prev) => prev.filter((x) => x.id !== item.id));
      setDones((prev) => [optimistic, ...prev]);
    } else {
      const optimistic = { ...item, status: "todo", done_at: undefined };
      setDones((prev) => prev.filter((x) => x.id !== item.id));
      setTodos((prev) => [...prev, optimistic]);
    }
    try {
      const updated = await api.updateProgressItem(idea.id, item.id, { status: nextStatus });
      setTodos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setDones((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      router.refresh();
    } catch (err) {
      setTodos(snapTodos);
      setDones(snapDones);
      notify.error(getErrorMessage(err));
    }
  }

  async function handleDelete(item: ProgressItem) {
    const snapTodos = todos;
    const snapDones = dones;
    setTodos((prev) => prev.filter((x) => x.id !== item.id));
    setDones((prev) => prev.filter((x) => x.id !== item.id));
    try {
      await api.deleteProgressItem(idea.id, item.id);
      notify.success(t("idea.progressDeleted"));
      router.refresh();
    } catch (err) {
      setTodos(snapTodos);
      setDones(snapDones);
      notify.error(getErrorMessage(err));
    }
  }

  const percent = total > 0 ? Math.round((dones.length / total) * 100) : 0;

  const todoRow = (item: ProgressItem) => (
    <li key={item.id} className="group flex items-center gap-2.5 py-1 text-[13px] leading-5">
      <button
        type="button"
        aria-label={t("idea.progressTodo")}
        disabled={!canEdit}
        onClick={() => void handleToggle(item)}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-[var(--rule)] transition-colors hover:border-[var(--accent-success)] disabled:cursor-default disabled:hover:border-[var(--rule)]"
      />
      <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{item.content}</span>
      {canEdit && (
        <button
          type="button"
          aria-label={t("idea.progressDelete")}
          onClick={() => void handleDelete(item)}
          className="shrink-0 text-[var(--ink-faint)] opacity-0 transition-opacity hover:text-[var(--ink)] group-hover:opacity-100"
        >
          <DeimosIcon name="close" className="h-3 w-3" />
        </button>
      )}
    </li>
  );

  const doneRow = (item: ProgressItem) => {
    const at = item.done_at || item.created_at;
    const href = evidenceHref(item, repoUrl);
    const chipLabel = item.commit_sha
      ? item.commit_sha.slice(0, 7)
      : (() => {
          try {
            return item.link_url ? new URL(item.link_url).hostname : "";
          } catch {
            return "";
          }
        })();
    return (
      <li key={item.id} className="group flex items-center gap-2.5 py-1 text-[13px] leading-5">
        <button
          type="button"
          aria-label={t("idea.progressUndo")}
          disabled={!canEdit}
          onClick={() => void handleToggle(item)}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-success-light)] text-[var(--accent-success)] disabled:cursor-default"
        >
          <DeimosIcon name="check" className="h-2.5 w-2.5" />
        </button>
        <span className="min-w-0 shrink truncate text-[var(--ink-soft)]">{item.content}</span>
        {chipLabel &&
          (href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden shrink-0 rounded-full border border-[var(--rule)] px-1.5 py-px font-mono text-[10.5px] tabular-nums text-[var(--accent-link)] hover:border-[var(--accent-link)]/40 sm:inline"
            >
              {chipLabel}
            </a>
          ) : (
            <span className="hidden shrink-0 rounded-full border border-[var(--rule)] px-1.5 py-px font-mono text-[10.5px] tabular-nums text-[var(--ink-faint)] sm:inline">
              {chipLabel}
            </span>
          ))}
        <time className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-[var(--ink-faint)]">
          {relativeTime(at, zh)}
        </time>
        {canEdit && (
          <button
            type="button"
            aria-label={t("idea.progressDelete")}
            onClick={() => void handleDelete(item)}
            className="shrink-0 text-[var(--ink-faint)] opacity-0 transition-opacity hover:text-[var(--ink)] group-hover:opacity-100"
          >
            <DeimosIcon name="close" className="h-3 w-3" />
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="surface-card px-4 py-3.5 sm:px-5" id="progress">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
          <DeimosIcon name="check" className="h-3.5 w-3.5 text-[var(--accent-success)]" />
          {t("idea.progressTitle")}
        </h2>
        <span className="text-[11px] tabular-nums text-[var(--ink-faint)]">
          {t("idea.progressCount", { done: dones.length, total })}
        </span>
        <div className="ml-auto h-1 w-20 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--accent-success)] transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {todos.length > 0 && (
        <div className="mb-1">
          <p className="mb-0.5 text-[11px] font-medium text-[var(--ink-faint)]">
            {t("idea.progressTodo")} · {todos.length}
          </p>
          <ul>{todos.map(todoRow)}</ul>
        </div>
      )}

      {dones.length > 0 && (
        <div>
          <p className="mb-0.5 text-[11px] font-medium text-[var(--ink-faint)]">
            {t("idea.progressDone")} · {dones.length}
          </p>
          {doneGroups.map((group) => (
            <div key={group.key} className="mb-1">
              <p className="mb-0.5 text-[11px] tabular-nums text-[var(--ink-faint)]">
                {dayLabel(group.key)}
              </p>
              <ul>{group.items.map(doneRow)}</ul>
            </div>
          ))}
        </div>
      )}

      {total === 0 && canEdit && (
        <p className="py-1 text-[12px] text-[var(--ink-faint)]">{t("idea.progressEmpty")}</p>
      )}
      {total > 0 && todos.length === 0 && (
        <p className="py-1 text-[12px] text-[var(--ink-faint)]">{t("idea.progressAllDone")}</p>
      )}

      {canEdit && (
        <input
          className="input-field mt-2 w-full text-[13px]"
          placeholder={t("idea.progressAddPlaceholder")}
          value={draft}
          maxLength={500}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            }
          }}
        />
      )}
    </section>
  );
}
