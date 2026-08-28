"use client";

import { AppLink } from "@/components/app-link";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

export type AccountSettingsSection =
  "profile" | "security" | "sessions" | "notifications" | "blocks" | "apikey";

type SettingsItem = {
  section: AccountSettingsSection;
  icon: DeimosIconName;
  label?: TranslationKey;
  literal?: string;
};

type LinkItem = {
  href: string;
  icon: DeimosIconName;
  label?: TranslationKey;
  literal?: string;
  match?: "exact" | "prefix";
};

type AccountNavItem = SettingsItem | LinkItem;

type Group = { title?: TranslationKey; literalTitle?: string; items: AccountNavItem[] };

const GROUPS: Group[] = [
  {
    title: "settings.title",
    items: [
      { section: "profile", icon: "profile", label: "settings.basicInfo" },
      { section: "security", icon: "lock", label: "settings.security" },
      { section: "sessions", icon: "chat", label: "settings.mySessions" },
      {
        section: "notifications",
        icon: "bell",
        label: "settings.notifPrefs",
      },
      {
        section: "blocks",
        icon: "shield",
        label: "settings.blockManage",
      },
    ],
  },
  {
    title: "settings.developer",
    items: [
      {
        href: "/user/agents",
        icon: "agent",
        label: "settings.myAgents",
      },
      {
        section: "apikey",
        icon: "key",
        label: "settings.agentApiKey",
      },
    ],
  },
  {
    title: "billing.title",
    items: [
      {
        href: "/billing",
        icon: "billing",
        label: "billing.membershipQuota",
        match: "exact",
      },
      {
        href: "/billing#orders",
        icon: "document",
        label: "billing.ordersRefunds",
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
  const { t } = useI18n();

  const itemClass = (active: boolean) =>
    `flex min-h-10 w-full shrink-0 items-center justify-between rounded-[var(--radius-btn)] px-3 py-2 text-left text-[13px] transition-colors ${
      active
        ? "border border-[var(--rule)] bg-[var(--action-soft)] font-medium text-[var(--ink)]"
        : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
    }`;

  const itemLabel = (item: AccountNavItem) =>
    item.label ? t(item.label) : item.literal ?? "";

  return (
    <aside className="w-full shrink-0 lg:w-[240px]">
      <div className="mb-4">
        <h1 className="heading-sans text-[22px]">
          {t("settings.title")}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          {t("settings.loginHint")}
        </p>
      </div>

      <nav
        className="surface-card grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 lg:block lg:space-y-4"
        aria-label={t("settings.title")}
      >
        {GROUPS.map((group) => (
          <div key={group.title ?? group.literalTitle} className="contents lg:block">
            <p className="mb-1 hidden px-3 font-code text-[11px] tracking-[0.12em] text-[var(--ink-faint)] lg:block">
              {group.title ? t(group.title) : group.literalTitle}
            </p>
            <div className="contents lg:block lg:space-y-0.5">
              {group.items.map((item) => {
                const label = itemLabel(item);

                if ("section" in item) {
                  const active = activeSection === item.section;
                  const badge =
                    item.section === "sessions" && sessionCount > 0
                      ? sessionCount
                      : item.section === "apikey"
                        ? t("activity.agent")
                        : item.section === "security" && !emailVerified
                          ? t("settings.unverified")
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
