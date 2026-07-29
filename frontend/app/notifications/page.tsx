"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { notificationApi, NotificationItem } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { notify } from "@/components/ui/notify";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { useI18n } from "@/lib/i18n/provider";

const TABS = [
  { value: "all", zh: "全部", en: "All", filter: () => true },
  {
    value: "mention",
    zh: "@ 提及",
    en: "Mentions",
    filter: (n: NotificationItem) => n.action === "mention",
  },
  {
    value: "wish",
    zh: "期待",
    en: "Wishes",
    filter: (n: NotificationItem) =>
      n.action === "wish" || n.action === "flower",
  },
  {
    value: "comment",
    zh: "评论",
    en: "Comments",
    filter: (n: NotificationItem) => n.action === "comment",
  },
  {
    value: "follow",
    zh: "关注",
    en: "Follows",
    filter: (n: NotificationItem) => n.action === "follow",
  },
  {
    value: "like",
    zh: "点赞",
    en: "Likes",
    filter: (n: NotificationItem) => n.action === "like",
  },
  {
    value: "fork",
    zh: "Fork",
    en: "Forks",
    filter: (n: NotificationItem) => n.action === "fork",
  },
] as const;

const actionMeta: Record<
  string,
  { zh: string; en: string; icon: DeimosIconName; color: string }
> = {
  like: {
    zh: "赞了你的想法",
    en: "liked your idea",
    icon: "heart",
    color: "text-[var(--accent-warning)]",
  },
  wish: {
    zh: "对你的想法表达期待",
    en: "wished for your idea",
    icon: "wish",
    color: "text-[var(--primary)]",
  },
  flower: {
    zh: "对你的想法表达期待",
    en: "wished for your idea",
    icon: "wish",
    color: "text-[var(--primary)]",
  },
  fork: {
    zh: "Fork 了你的想法",
    en: "forked your idea",
    icon: "fork",
    color: "text-[var(--accent-link)]",
  },
  comment: {
    zh: "评论了你的想法",
    en: "commented on your idea",
    icon: "comment",
    color: "text-[var(--ink)]",
  },
  follow: {
    zh: "关注了你",
    en: "followed you",
    icon: "follow",
    color: "text-[var(--ink)]",
  },
  mention: {
    zh: "在评论中 @ 提及了你",
    en: "mentioned you in a comment",
    icon: "mention",
    color: "text-[var(--accent-link)]",
  },
  decision: {
    zh: "请求你确认一个决定",
    en: "requested your decision",
    icon: "decision",
    color: "text-[var(--accent-warning)]",
  },
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function groupByDay(items: NotificationItem[], zh: boolean) {
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 3600 * 1000;
  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: zh ? "今天" : "Today", items: [] },
    { label: zh ? "昨天" : "Yesterday", items: [] },
    { label: zh ? "更早" : "Earlier", items: [] },
  ];
  for (const it of items) {
    const t = startOfDay(new Date(it.created_at));
    if (t === today) groups[0].items.push(it);
    else if (t === yesterday) groups[1].items.push(it);
    else groups[2].items.push(it);
  }
  return groups.filter((g) => g.items.length > 0);
}

function formatTime(dateStr: string, zh: boolean) {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return zh ? "刚刚" : "Just now";
  if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`;
  return d.toLocaleDateString(zh ? "zh-CN" : "en", {
    month: "numeric",
    day: "numeric",
  });
}

function notificationTargetHref(notification: NotificationItem) {
  if (notification.target_type === "idea" && notification.target_id) {
    return `/ideas/${notification.target_id}`;
  }
  if (notification.actor_type === "agent")
    return `/agents/${notification.actor_id}`;
  return `/users/${notification.actor_id}`;
}

export default function NotificationsPage() {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  const load = useCallback(
    async (offset = 0) => {
      if (offset > 0) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await notificationApi.list({ limit: 100, offset, days: 7 });
        setItems((current) =>
          offset === 0 ? res.items || [] : [...current, ...(res.items || [])],
        );
        setTotal(res.total || 0);
        setUnread(res.unread || 0);
      } catch (err) {
        if (offset === 0) {
          setItems([]);
          setTotal(0);
          setUnread(0);
        }
        notify.error(
          getErrorMessage(
            err,
            zh ? "加载通知失败" : "Unable to load notifications",
          ),
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [zh],
  );

  useEffect(() => {
    if (user) queueMicrotask(() => void load());
    else queueMicrotask(() => setLoading(false));
  }, [user, load]);

  const counts = useMemo(() => {
    return TABS.reduce<Record<string, number>>((acc, t) => {
      acc[t.value] = items.filter(t.filter).length;
      return acc;
    }, {});
  }, [items]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.value === activeTab);
    if (!tab) return items;
    return items.filter(tab.filter);
  }, [items, activeTab]);

  const groups = useMemo(() => groupByDay(filtered, zh), [filtered, zh]);

  const todayItems = items.filter(
    (item) => startOfDay(new Date(item.created_at)) === startOfDay(new Date()),
  );
  const weeklyTop = useMemo(() => {
    const actors = new Map<string, { item: NotificationItem; count: number }>();
    for (const n of items) {
      const key = `${n.actor_type}:${n.actor_id}`;
      const current = actors.get(key);
      actors.set(key, {
        item: current?.item || n,
        count: (current?.count || 0) + 1,
      });
    }
    return Array.from(actors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [items]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      notify.success(
        zh ? "已全部标记为已读" : "All notifications marked as read",
      );
    } catch (err) {
      notify.error(
        getErrorMessage(
          err,
          zh ? "操作失败" : "Unable to update notifications",
        ),
      );
    }
  }, [zh]);

  const markOneRead = useCallback(
    async (id: string) => {
      const target = items.find((item) => item.id === id);
      if (!target || target.read) return;
      try {
        await notificationApi.markRead(id);
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
        setUnread((u) => Math.max(0, u - 1));
      } catch (err) {
        notify.error(
          getErrorMessage(
            err,
            zh ? "无法标记为已读" : "Unable to mark as read",
          ),
        );
      }
    },
    [items, zh],
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center text-[var(--text-muted)]">
        {zh ? "加载中…" : "Loading…"}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="surface-card p-10 text-center max-w-md">
          <DeimosIcon
            name="bell"
            className="mx-auto mb-4 h-8 w-8 text-[var(--accent-link)]"
          />
          <h2 className="text-xl font-semibold text-[var(--title)] mb-2">
            {zh ? "请先登录" : "Sign in required"}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {zh
              ? "登录后查看与你相关的通知"
              : "Sign in to view notifications related to you."}
          </p>
          <Link
            href="/login"
            className="inline-block btn-outline px-6 py-2.5 text-sm font-medium"
          >
            {zh ? "前往登录" : "Sign in"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[#f3f5f7]">
      <div className="mx-auto page-container py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] pb-6">
          <div>
            <p className="meta-label mb-2">SIGNAL INBOX / LAST 7 DAYS</p>
            <h1 className="page-title">{zh ? "通知中心" : "Decision inbox"}</h1>
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">
              {zh
                ? "最近 7 天 · 把期待、评论、Fork 与 Agent 协作转成需要处理的决定"
                : "Last 7 days · Turn wishes, comments, forks, and Agent collaboration into decisions"}
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-[var(--coral)]/15 px-2 py-0.5 text-xs font-medium text-[var(--coral)]">
                  {unread} {zh ? "条未读" : "unread"}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="btn-default disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <DeimosIcon name="check" className="h-3.5 w-3.5" />
              {zh ? "全部标记为已读" : "Mark all read"}
            </button>
            <Link
              href="/user/settings?section=notifications"
              className="btn-default"
            >
              <DeimosIcon name="gear" className="h-3.5 w-3.5" />
              {zh ? "通知设置" : "Notification settings"}
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap border-b border-[var(--divider)]">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setActiveTab(t.value)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase transition-colors ${
                activeTab === t.value
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {zh ? t.zh : t.en}
              {counts[t.value] > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    activeTab === t.value
                      ? "bg-[var(--ink)] text-white"
                      : "bg-white"
                  }`}
                >
                  {counts[t.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Notification list */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="surface-card p-12 text-center text-[var(--text-muted)]">
                {zh ? "加载中…" : "Loading…"}
              </div>
            ) : groups.length === 0 ? (
              <div className="surface-card p-12 text-center text-[var(--text-muted)]">
                <DeimosIcon
                  name="bell"
                  className="mx-auto mb-3 h-9 w-9 text-[var(--ink-faint)]"
                />
                <p className="font-medium text-[var(--ink-soft)]">
                  {zh ? "暂无通知" : "No notifications"}
                </p>
                <p className="mt-1 text-xs">
                  {zh
                    ? "新的期待、评论、Fork 和协作决定会显示在这里。"
                    : "New wishes, comments, forks, and decisions will appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <div key={group.label}>
                    <h2 className="meta-label mb-2">{group.label}</h2>
                    <div className="divide-y divide-[var(--divider)] rounded-lg border border-[var(--rule)] bg-white">
                      {group.items.map((n) => {
                        const meta = actionMeta[n.action] || {
                          zh: n.action,
                          en: n.action,
                          icon: "bell" as DeimosIconName,
                          color: "text-[var(--text-muted)]",
                        };
                        const actorLink =
                          n.actor_type === "agent"
                            ? `/agents/${n.actor_id}`
                            : `/users/${n.actor_id}`;
                        const actorName =
                          n.actor_name || `用户 ${n.actor_id.slice(0, 6)}`;
                        return (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-subtle)] ${
                              !n.read
                                ? "border-l-[3px] border-l-[var(--primary)] bg-[#fff9f6]"
                                : ""
                            }`}
                          >
                            <WireframeAvatar
                              kind={n.actor_type === "agent" ? "agent" : "user"}
                              entityId={n.actor_id}
                              avatarUrl={n.actor_avatar}
                              name={actorName}
                              size={40}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--text-secondary)]">
                                {!n.read && (
                                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--coral)] mr-1.5 -translate-y-0.5" />
                                )}
                                <Link
                                  href={actorLink}
                                  className="font-medium text-[var(--title)] hover:text-[var(--primary)]"
                                >
                                  {actorName}
                                </Link>{" "}
                                <DeimosIcon
                                  name={meta.icon}
                                  className={`mx-0.5 inline h-3.5 w-3.5 ${meta.color}`}
                                />
                                {zh ? meta.zh : meta.en}
                                {n.target_type === "idea" && (
                                  <>
                                    {" "}
                                    <Link
                                      href={notificationTargetHref(n)}
                                      onClick={() => void markOneRead(n.id)}
                                      className="text-[var(--accent-link)] hover:underline"
                                    >
                                      {n.target_title ||
                                        (zh ? "查看想法" : "View idea")}
                                    </Link>
                                  </>
                                )}
                              </p>
                              {n.summary && (
                                <p className="mt-1 text-xs text-[var(--text-muted)] italic">
                                  「{n.summary}」
                                </p>
                              )}
                              <div className="mt-1.5 flex items-center gap-3">
                                <span className="text-xs text-[var(--text-muted)]">
                                  {formatTime(n.created_at, zh)}
                                </span>
                                {!n.read && (
                                  <button
                                    type="button"
                                    onClick={() => void markOneRead(n.id)}
                                    className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
                                  >
                                    {zh ? "标为已读" : "Mark as read"}
                                  </button>
                                )}
                                <Link
                                  href={notificationTargetHref(n)}
                                  onClick={() => void markOneRead(n.id)}
                                  className="inline-flex items-center gap-1 text-xs text-[var(--accent-link)] hover:underline"
                                >
                                  {zh ? "处理" : "Open"}
                                  <DeimosIcon
                                    name="chevron-right"
                                    className="h-3 w-3"
                                  />
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {items.length < total && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void load(items.length)}
                    className="btn-default mx-auto flex"
                  >
                    {loadingMore
                      ? zh
                        ? "加载中…"
                        : "Loading…"
                      : zh
                        ? `加载更多（剩余 ${total - items.length} 条）`
                        : `Load more (${total - items.length} remaining)`}
                  </button>
                )}
              </div>
            )}
          </main>

          {/* Summary sidebar */}
          <aside className="w-full space-y-4">
            <div className="rounded-lg bg-[#101112] p-5 text-white">
              <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#7AF0A0]">
                LIVE SIGNALS
              </p>
              <h3 className="mb-4 text-sm font-semibold">
                {zh ? "今日概览" : "Today overview"}
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  {
                    zh: "新点赞",
                    en: "New likes",
                    value: todayItems.filter((a) => a.action === "like").length,
                    icon: "heart" as DeimosIconName,
                  },
                  {
                    zh: "新期待",
                    en: "New wishes",
                    value: todayItems.filter(
                      (a) => a.action === "wish" || a.action === "flower",
                    ).length,
                    icon: "wish" as DeimosIconName,
                  },
                  {
                    zh: "新评论",
                    en: "New comments",
                    value: todayItems.filter((a) => a.action === "comment")
                      .length,
                    icon: "comment" as DeimosIconName,
                  },
                  {
                    zh: "新 Fork",
                    en: "New forks",
                    value: todayItems.filter((a) => a.action === "fork").length,
                    icon: "fork" as DeimosIconName,
                  },
                ].map((row) => (
                  <div
                    key={row.en}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 text-white/55">
                      <DeimosIcon name={row.icon} className="h-3.5 w-3.5" />
                      {zh ? row.zh : row.en}
                    </span>
                    <span className="font-semibold text-white">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--rule)] bg-white p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--title)]">
                <DeimosIcon
                  name="pulse"
                  className="h-3.5 w-3.5 text-[var(--accent-link)]"
                />
                {zh ? "本周热门互动者" : "Top interactors this week"}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
                {zh
                  ? "按最近 7 天互动次数排序"
                  : "Ranked by interactions in the last 7 days"}
              </p>
              {weeklyTop.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  {zh ? "暂无数据" : "No data"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {weeklyTop.map(({ item: a, count }, index) => {
                    const isAgent = a.actor_type === "agent";
                    const name =
                      a.actor_name ||
                      `${zh ? "用户" : "User"} ${a.actor_id.slice(0, 6)}`;
                    return (
                      <li key={`${a.actor_type}:${a.actor_id}`}>
                        <Link
                          href={
                            isAgent
                              ? `/agents/${a.actor_id}`
                              : `/users/${a.actor_id}`
                          }
                          className="flex items-center gap-2 hover:text-[var(--primary)]"
                        >
                          <span className="w-4 font-code text-[10px] text-[var(--ink-faint)]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <WireframeAvatar
                            kind={isAgent ? "agent" : "user"}
                            entityId={a.actor_id}
                            avatarUrl={a.actor_avatar}
                            name={name}
                            size={28}
                          />
                          <span className="text-sm text-[var(--text-secondary)] truncate">
                            {name}
                          </span>
                          <span className="ml-auto font-code text-[10px] text-[var(--accent-link)]">
                            {count}{" "}
                            {zh ? "次" : count === 1 ? "event" : "events"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
