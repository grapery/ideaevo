"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { notificationApi, NotificationItem } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { notify } from "@/components/ui/notify";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import { EmptyState } from "@/components/empty-state";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

const TABS: ReadonlyArray<{
  value: string;
  labelKey: TranslationKey;
  filter: (n: NotificationItem) => boolean;
}> = [
  { value: "all", labelKey: "notif.tabAll", filter: () => true },
  {
    value: "mention",
    labelKey: "notif.tabMention",
    filter: (n: NotificationItem) => n.action === "mention",
  },
  {
    value: "wish",
    labelKey: "notif.tabWish",
    filter: (n: NotificationItem) =>
      n.action === "wish" || n.action === "flower",
  },
  {
    value: "comment",
    labelKey: "notif.tabComment",
    filter: (n: NotificationItem) => n.action === "comment",
  },
  {
    value: "follow",
    labelKey: "notif.tabFollow",
    filter: (n: NotificationItem) => n.action === "follow",
  },
  {
    value: "like",
    labelKey: "notif.tabLike",
    filter: (n: NotificationItem) => n.action === "like",
  },
  {
    value: "fork",
    labelKey: "notif.tabFork",
    filter: (n: NotificationItem) => n.action === "fork",
  },
];

const actionMeta: Record<
  string,
  { labelKey: TranslationKey; icon: DeimosIconName; color: string }
> = {
  like: {
    labelKey: "notif.notifLiked",
    icon: "heart",
    color: "text-[var(--accent-warning)]",
  },
  wish: {
    labelKey: "notif.notifWished",
    icon: "wish",
    color: "text-[var(--primary)]",
  },
  flower: {
    labelKey: "notif.notifWished",
    icon: "wish",
    color: "text-[var(--primary)]",
  },
  fork: {
    labelKey: "notif.notifForked",
    icon: "fork",
    color: "text-[var(--accent-link)]",
  },
  suggestion: {
    labelKey: "notif.notifSuggested",
    icon: "decision",
    color: "text-[var(--accent-link)]",
  },
  suggestion_selected: {
    labelKey: "notif.notifSelected",
    icon: "check",
    color: "text-[var(--accent-success)]",
  },
  suggestion_implemented: {
    labelKey: "notif.notifImplemented",
    icon: "lifecycle",
    color: "text-[var(--accent-success)]",
  },
  comment: {
    labelKey: "notif.notifCommented",
    icon: "comment",
    color: "text-[var(--ink)]",
  },
  follow: {
    labelKey: "notif.notifFollowed",
    icon: "follow",
    color: "text-[var(--ink)]",
  },
  mention: {
    labelKey: "notif.notifMentioned",
    icon: "mention",
    color: "text-[var(--accent-link)]",
  },
  decision: {
    labelKey: "notif.notifDecision",
    icon: "decision",
    color: "text-[var(--accent-warning)]",
  },
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function groupByDay(
  items: NotificationItem[],
  t: (key: TranslationKey) => string,
) {
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 3600 * 1000;
  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: t("common.today"), items: [] },
    { label: t("common.yesterday"), items: [] },
    { label: t("common.earlier"), items: [] },
  ];
  for (const it of items) {
    const ts = startOfDay(new Date(it.created_at));
    if (ts === today) groups[0].items.push(it);
    else if (ts === yesterday) groups[1].items.push(it);
    else groups[2].items.push(it);
  }
  return groups.filter((g) => g.items.length > 0);
}

function formatTime(
  dateStr: string,
  locale: string,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return t("common.justNow");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  return d.toLocaleDateString(locale === "zh-CN" ? "zh-CN" : "en", {
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
  const { t, locale } = useI18n();
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
        notify.error(getErrorMessage(err, t("notif.loadFailed")));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (user) queueMicrotask(() => void load());
    else queueMicrotask(() => setLoading(false));
  }, [user, load]);

  const counts = useMemo(() => {
    return TABS.reduce<Record<string, number>>((acc, tab) => {
      acc[tab.value] = items.filter(tab.filter).length;
      return acc;
    }, {});
  }, [items]);

  const filtered = useMemo(() => {
    const tab = TABS.find((tb) => tb.value === activeTab);
    if (!tab) return items;
    return items.filter(tab.filter);
  }, [items, activeTab]);

  const groups = useMemo(() => groupByDay(filtered, t), [filtered, t]);

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
      notify.success(t("notif.allMarkedRead"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    }
  }, [t]);

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
        notify.error(getErrorMessage(err, t("notif.markReadFailed")));
      }
    },
    [items, t],
  );

  if (authLoading) {
    return (
      <div className="page-shell-full flex items-center justify-center text-[var(--text-muted)]">
        {t("common.loading")}
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
            {t("notif.loginRequired")}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {t("notif.loginHint")}
          </p>
          <Link
            href="/login"
            className="inline-block btn-outline px-6 py-2.5 text-sm font-medium"
          >
            {t("settings.goLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container page-pad">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] pb-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold tracking-[-0.02em] text-[var(--ink)] sm:text-[20px]">
              {t("notif.center")}
              {unread > 0 && (
                <span className="rounded-full bg-[var(--accent-warning-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-warning)]">
                  {t("notif.unreadCount", { count: unread })}
                </span>
              )}
            </h1>
            <p className="mt-0.5 text-[12px] text-[var(--ink-faint)]">{t("notif.recentHint")}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="btn-default btn-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              <DeimosIcon name="check" className="h-3.5 w-3.5" />
              {t("notif.markAllRead")}
            </button>
            <Link
              href="/user/settings?section=notifications"
              className="btn-default btn-sm"
            >
              <DeimosIcon name="gear" className="h-3.5 w-3.5" />
              {t("notif.settings")}
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <nav className="tabbar mb-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              data-active={activeTab === tab.value ? "true" : undefined}
              className="tabbar-tab"
            >
              {t(tab.labelKey)}
              {counts[tab.value] > 0 && (
                <span className="count-badge">{counts[tab.value]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="app-grid-2">
          {/* Notification list */}
          <section className="flex-1 min-w-0">
            {loading ? (
              <div className="surface-card p-12 text-center text-[var(--text-muted)]">
                {t("common.loading")}
              </div>
            ) : groups.length === 0 ? (
              <EmptyState icon="bell" title={t("notif.empty")} hint={t("notif.emptyHint")} variant="dashed" />
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <div key={group.label}>
                    <h2 className="meta-label mb-2">{group.label}</h2>
                    <div className="divide-y divide-[var(--divider)] surface-card">
                      {group.items.map((n) => {
                        const meta = actionMeta[n.action] || {
                          labelKey: "notif.center" as TranslationKey,
                          icon: "bell" as DeimosIconName,
                          color: "text-[var(--text-muted)]",
                        };
                        const actorLink =
                          n.actor_type === "agent"
                            ? `/agents/${n.actor_id}`
                            : `/users/${n.actor_id}`;
                        const actorName =
                          n.actor_name ||
                          `${t("activity.user")} ${n.actor_id.slice(0, 6)}`;
                        return (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-subtle)] ${
                              !n.read
                                ? "border-l-[3px] border-l-[var(--primary)] bg-[var(--primary-soft)]"
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
                                {t(meta.labelKey)}
                                {n.target_type === "idea" && (
                                  <>
                                    {" "}
                                    <Link
                                      href={notificationTargetHref(n)}
                                      onClick={() => void markOneRead(n.id)}
                                      className="text-[var(--accent-link)] hover:underline"
                                    >
                                      {n.target_title || t("notif.viewIdea")}
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
                                  {formatTime(n.created_at, locale, t)}
                                </span>
                                {!n.read && (
                                  <button
                                    type="button"
                                    onClick={() => void markOneRead(n.id)}
                                    className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
                                  >
                                    {t("notif.markRead")}
                                  </button>
                                )}
                                <Link
                                  href={notificationTargetHref(n)}
                                  onClick={() => void markOneRead(n.id)}
                                  className="inline-flex items-center gap-1 text-xs text-[var(--accent-link)] hover:underline"
                                >
                                  {t("notif.handle")}
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
                      ? t("common.loading")
                      : t("notif.loadMore", { count: total - items.length })}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Summary sidebar */}
          <aside className="w-full space-y-3">
            <section className="surface-card overflow-hidden">
              <div className="flex h-10 items-center border-b border-[var(--rule)] px-3.5">
                <h3 className="text-[13px] font-semibold text-[var(--ink)]">
                  {t("notif.todayOverview")}
                </h3>
              </div>
              <div className="divide-y divide-[var(--rule)]">
                {(
                  [
                    {
                      id: "likes",
                      labelKey: "notif.statNewLikes" as TranslationKey,
                      value: todayItems.filter((a) => a.action === "like")
                        .length,
                      icon: "heart" as DeimosIconName,
                    },
                    {
                      id: "wishes",
                      labelKey: "notif.statNewWishes" as TranslationKey,
                      value: todayItems.filter(
                        (a) => a.action === "wish" || a.action === "flower",
                      ).length,
                      icon: "wish" as DeimosIconName,
                    },
                    {
                      id: "comments",
                      labelKey: "notif.statNewComments" as TranslationKey,
                      value: todayItems.filter((a) => a.action === "comment")
                        .length,
                      icon: "comment" as DeimosIconName,
                    },
                    {
                      id: "forks",
                      labelKey: "notif.statNewForks" as TranslationKey,
                      value: todayItems.filter((a) => a.action === "fork")
                        .length,
                      icon: "fork" as DeimosIconName,
                    },
                  ]
                ).map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between px-3.5 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-[12px] text-[var(--ink-soft)]">
                      <DeimosIcon name={row.icon} className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
                      {t(row.labelKey)}
                    </span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="surface-card p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--title)]">
                <DeimosIcon
                  name="pulse"
                  className="h-3.5 w-3.5 text-[var(--accent-link)]"
                />
                {t("notif.weeklyTop")}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
                {t("notif.weeklyHint")}
              </p>
              {weeklyTop.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  {t("common.noData")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {weeklyTop.map(({ item: a, count }, index) => {
                    const isAgent = a.actor_type === "agent";
                    const name =
                      a.actor_name ||
                      `${t("activity.user")} ${a.actor_id.slice(0, 6)}`;
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
                            {count} {t("notif.times")}
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
