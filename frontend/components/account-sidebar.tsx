"use client";

import { AppLink } from "@/components/app-link";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

export type AccountSettingsSection =
  "profile" | "security" | "sessions" | "notifications" | "blocks" | "apikey";

type SettingsItem = {
  section: AccountSettingsSection;
  icon: DeimosIconName;
  zh: string;
  en: string;
};

type LinkItem = {
  href: string;
  icon: DeimosIconName;
  zh: string;
  en: string;
  match?: "exact" | "prefix";
};

type AccountNavItem = SettingsItem | LinkItem;

const GROUPS: { zh: string; en: string; items: AccountNavItem[] }[] = [
  {
    zh: "账户",
    en: "ACCOUNT",
    items: [
      { section: "profile", icon: "profile", zh: "个人资料", en: "Profile" },
      { section: "security", icon: "lock", zh: "账号安全", en: "Security" },
      { section: "sessions", icon: "chat", zh: "我的会话", en: "Sessions" },
      {
        section: "notifications",
        icon: "bell",
        zh: "通知偏好",
        en: "Notifications",
      },
      {
        section: "blocks",
        icon: "shield",
        zh: "屏蔽管理",
        en: "Blocked users",
      },
    ],
  },
  {
    zh: "开发者",
    en: "DEVELOPER",
    items: [
      {
        href: "/user/agents",
        icon: "agent",
        zh: "我的 Agent",
        en: "My Agents",
      },
      {
        section: "apikey",
        icon: "key",
        zh: "Agent API Key",
        en: "Agent API Key",
      },
    ],
  },
  {
    zh: "账单",
    en: "BILLING",
    items: [
      {
        href: "/billing",
        icon: "billing",
        zh: "会员与配额",
        en: "Membership & quota",
        match: "exact",
      },
      {
        href: "/billing#orders",
        icon: "document",
        zh: "订单与退款",
        en: "Orders & refunds",
      },
    ],
  },
];

type AccountSidebarProps = {
  activeSection?: AccountSettingsSection;
  activePath?: string;
  onSectionChange?: (section: AccountSettingsSection) => void;
  sessionCount?: number;
  emailVerified?: boolean;
};

export function AccountSidebar({
  activeSection,
  activePath,
  onSectionChange,
  sessionCount = 0,
  emailVerified = true,
}: AccountSidebarProps) {
  const { locale } = useI18n();
  const zh = locale === "zh-CN";

  const itemClass = (active: boolean) =>
    `flex min-h-10 w-full shrink-0 items-center justify-between rounded-[6px] px-3 py-2 text-left text-[13px] transition-colors ${
      active
        ? "border border-[var(--accent-link)] bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
        : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
    }`;

  return (
    <aside className="w-full shrink-0 lg:w-[240px]">
      <div className="mb-4">
        <h1 className="heading-sans text-[22px]">
          {zh ? "账户控制中心" : "Account control center"}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          {zh
            ? "管理身份、Agent 与账单"
            : "Manage identity, Agents, and billing"}
        </p>
      </div>

      <nav
        className="surface-card grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 lg:block lg:space-y-4"
        aria-label={zh ? "账户设置导航" : "Account settings navigation"}
      >
        {GROUPS.map((group) => (
          <div key={group.en} className="contents lg:block">
            <p className="mb-1 hidden px-3 font-code text-[9px] tracking-[0.12em] text-[var(--ink-faint)] lg:block">
              {zh ? group.zh : group.en}
            </p>
            <div className="contents lg:block lg:space-y-0.5">
              {group.items.map((item) => {
                const label = zh ? item.zh : item.en;

                if ("section" in item) {
                  const active = activeSection === item.section;
                  const badge =
                    item.section === "sessions" && sessionCount > 0
                      ? sessionCount
                      : item.section === "apikey"
                        ? "Agent"
                        : item.section === "security" && !emailVerified
                          ? zh
                            ? "未验证"
                            : "Unverified"
                          : null;

                  const content = (
                    <>
                      <span className="flex items-center gap-2.5">
                        <DeimosIcon name={item.icon} className="h-4 w-4" />
                        {label}
                      </span>
                      {badge !== null && (
                        <span className="ml-3 rounded-full bg-white/75 px-2 py-0.5 text-[10px] text-[var(--ink-soft)]">
                          {badge}
                        </span>
                      )}
                    </>
                  );

                  return onSectionChange ? (
                    <button
                      key={item.section}
                      type="button"
                      onClick={() => onSectionChange?.(item.section)}
                      className={itemClass(active)}
                      aria-current={active ? "page" : undefined}
                    >
                      {content}
                    </button>
                  ) : (
                    <AppLink
                      key={item.section}
                      href={`/user/settings?section=${item.section}`}
                      className={itemClass(false)}
                    >
                      {content}
                    </AppLink>
                  );
                }

                const active =
                  activePath === item.href ||
                  (item.match === "prefix" &&
                    Boolean(activePath?.startsWith(item.href)));

                return (
                  <AppLink
                    key={item.href}
                    href={item.href}
                    className={itemClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="flex items-center gap-2.5">
                      <DeimosIcon name={item.icon} className="h-4 w-4" />
                      {label}
                    </span>
                    <DeimosIcon
                      name="chevron-right"
                      className="ml-3 h-3 w-3 opacity-55"
                    />
                  </AppLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
