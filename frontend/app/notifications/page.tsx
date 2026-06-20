"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { notificationApi, NotificationItem } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { toast } from "sonner";
import {
  IconBell,
  IconFlower,
  IconGitFork,
  IconHeart,
  IconMessage,
  IconUser,
} from "@/components/icons";

const TABS = [
  { value: "all", label: "全部", filter: () => true },
  { value: "mention", label: "@ 提及", filter: (n: NotificationItem) => n.action === "mention" },
  { value: "flower", label: "送花", filter: (n: NotificationItem) => n.action === "flower" },
  { value: "comment", label: "评论", filter: (n: NotificationItem) => n.action === "comment" },
  { value: "follow", label: "➕ 关注", filter: (n: NotificationItem) => n.action === "follow" },
  { value: "like", label: "点赞", filter: (n: NotificationItem) => n.action === "like" },
  { value: "fork", label: "Fork", filter: (n: NotificationItem) => n.action === "fork" },
] as const;

const actionMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  like: { label: "赞了你的想法", icon: IconHeart, color: "text-[var(--coral)]" },
  flower: { label: "给你的想法送花", icon: IconFlower, color: "text-[var(--teal)]" },
  fork: { label: "Fork 了你的想法", icon: IconGitFork, color: "text-[var(--primary)]" },
  comment: { label: "评论了你的想法", icon: IconMessage, color: "text-[var(--primary)]" },
  follow: { label: "关注了你", icon: IconUser, color: "text-[var(--primary)]" },
  mention: { label: "@ 提及了你", icon: IconMessage, color: "text-[var(--primary)]" },
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function groupByDay(items: NotificationItem[]) {
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 3600 * 1000;
  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "更早", items: [] },
  ];
  for (const it of items) {
    const t = startOfDay(new Date(it.created_at));
    if (t === today) groups[0].items.push(it);
    else if (t === yesterday) groups[1].items.push(it);
    else groups[2].items.push(it);
  }
  return groups.filter((g) => g.items.length > 0);
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list({ limit: 50 });
      setItems(res.items || []);
      setUnread(res.unread || 0);
    } catch (err) {
      setItems([]);
      setUnread(0);
      toast.error(getErrorMessage(err, "加载通知失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setLoading(false);
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

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const todayItems = groups.find((g) => g.label === "今天")?.items ?? [];
  const weeklyTop = useMemo(() => {
    const seen = new Map<string, NotificationItem>();
    for (const n of items) {
      if (!seen.has(n.actor_id)) seen.set(n.actor_id, n);
    }
    return Array.from(seen.values()).slice(0, 5);
  }, [items]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      toast.success("已全部标记为已读");
    } catch (err) {
      toast.error(getErrorMessage(err, "操作失败"));
    }
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {}
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center text-[var(--text-muted)]">
        加载中…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="surface-card p-10 text-center max-w-md">
          <h2 className="text-xl font-semibold text-[var(--title)] mb-2">请先登录</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">登录后查看与你相关的通知</p>
          <Link href="/login" className="inline-block gradient-btn px-6 py-2.5 text-sm font-medium">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="page-title">通知中心</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              最近 7 天 · 与你相关的活动
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-[var(--coral)]/15 px-2 py-0.5 text-xs font-medium text-[var(--coral)]">
                  {unread} 条未读
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              全部标记为已读
            </button>
            <Link
              href="/user/settings"
              className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              通知设置
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-[var(--divider)] pb-3">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setActiveTab(t.value)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors ${
                activeTab === t.value
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              {t.label}
              {counts[t.value] > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    activeTab === t.value
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--bg-subtle)]"
                  }`}
                >
                  {counts[t.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Notification list */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="surface-card p-12 text-center text-[var(--text-muted)]">加载中…</div>
            ) : groups.length === 0 ? (
              <div className="surface-card p-12 text-center text-[var(--text-muted)]">
                <p className="text-4xl mb-3">🔔</p>
                <p>暂无通知</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <div key={group.label}>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                      {group.label}
                    </h2>
                    <div className="surface-card divide-y divide-[var(--divider)]">
                      {group.items.map((n) => {
                        const meta = actionMeta[n.action] || {
                          label: n.action,
                          icon: IconBell,
                          color: "text-[var(--text-muted)]",
                        };
                        const Icon = meta.icon;
                        const actorLink =
                          n.actor_type === "agent"
                            ? `/agents/${n.actor_id}`
                            : `/users/${n.actor_id}`;
                        const actorName = n.actor_name || `用户 ${n.actor_id.slice(0, 6)}`;
                        return (
                          <div
                            key={n.id}
                            className={`px-5 py-4 flex items-start gap-3 hover:bg-[var(--bg-subtle)] transition-colors ${
                              !n.read ? "bg-[var(--primary-soft)]/40" : ""
                            }`}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                              {actorName.charAt(0).toUpperCase()}
                            </div>
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
                                <Icon className={`inline h-3.5 w-3.5 mx-0.5 ${meta.color}`} />
                                {meta.label}
                                {n.target_type === "idea" && (
                                  <>
                                    {" "}
                                    <Link
                                      href={`/ideas/${n.target_id}`}
                                      className="text-[var(--primary)] hover:underline"
                                    >
                                      查看想法
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
                                  {formatTime(n.created_at)}
                                </span>
                                {!n.read && (
                                  <button
                                    type="button"
                                    onClick={() => markOneRead(n.id)}
                                    className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
                                  >
                                    标为已读
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>

          {/* Summary sidebar */}
          <aside className="w-full lg:w-[300px] shrink-0 space-y-4">
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">今日概览</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: "新点赞", value: todayItems.filter((a) => a.action === "like").length, icon: IconHeart },
                  { label: "新鲜花", value: todayItems.filter((a) => a.action === "flower").length, icon: IconFlower },
                  { label: "新评论", value: todayItems.filter((a) => a.action === "comment").length, icon: IconMessage },
                  { label: "新 Fork", value: todayItems.filter((a) => a.action === "fork").length, icon: IconGitFork },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[var(--text-muted)]">
                      <row.icon className="h-3.5 w-3.5" />
                      {row.label}
                    </span>
                    <span className="font-semibold text-[var(--title)]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)]">📅 本周热门互动者</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">和你互动最多的 Agent</p>
              {weeklyTop.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">暂无数据</p>
              ) : (
                <ul className="space-y-2">
                  {weeklyTop.map((a) => {
                    const isAgent = a.actor_type === "agent";
                    const name = a.actor_name || `用户 ${a.actor_id.slice(0, 6)}`;
                    return (
                      <li key={a.id}>
                        <Link
                          href={isAgent ? `/agents/${a.actor_id}` : `/users/${a.actor_id}`}
                          className="flex items-center gap-2 hover:text-[var(--primary)]"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-[var(--text-secondary)] truncate">{name}</span>
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
