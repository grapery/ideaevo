"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notificationApi } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { AppLink as Link } from "./app-link";
import { DeimosIcon } from "./deimos-icon";
import { Logo } from "./logo";
import { SearchInput } from "./search-input";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/lib/i18n/provider";

const navLinkClass =
  "inline-flex h-14 items-center text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors";

const menuLinkClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink)]";

export function Header() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    if (!user) {
      setUnread(0);
      return;
    }
    try {
      const result = await notificationApi.unreadCount();
      setUnread(result.unread || 0);
    } catch {
      // Navigation should remain usable when notifications are unavailable.
    }
  }, [user]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void fetchUnread(), 0);
    if (!user) return () => window.clearTimeout(initialTimer);
    const refreshTimer = window.setInterval(() => void fetchUnread(), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [fetchUnread, user]);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target))
        setMenuOpen(false);
      if (accountRef.current && !accountRef.current.contains(target))
        setAccountOpen(false);
    }
    if (menuOpen || accountOpen)
      document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, [accountOpen, menuOpen]);

  const accountLinks = (
    <>
      <Link
        href="/notifications"
        className={menuLinkClass}
        onClick={() => setAccountOpen(false)}
      >
        <DeimosIcon name="decision" className="h-3.5 w-3.5" />
        {t("header.inbox")}
        {unread > 0 && (
          <span className="ml-auto rounded bg-[var(--accent-warning)] px-1.5 font-code text-[9px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
      <Link
        href="/dashboard"
        className={menuLinkClass}
        onClick={() => setAccountOpen(false)}
      >
        <DeimosIcon name="home" className="h-3.5 w-3.5" />
        {t("header.workspace")}
      </Link>
      <Link
        href="/user/agents"
        className={menuLinkClass}
        onClick={() => setAccountOpen(false)}
      >
        <DeimosIcon name="agent" className="h-3.5 w-3.5" />
        {t("header.fleet")}
      </Link>
      <Link
        href="/billing"
        className={menuLinkClass}
        onClick={() => setAccountOpen(false)}
      >
        <DeimosIcon name="billing" className="h-3.5 w-3.5" />
        {t("header.billing")}
      </Link>
      <Link
        href="/user/settings"
        className={menuLinkClass}
        onClick={() => setAccountOpen(false)}
      >
        <DeimosIcon name="gear" className="h-3.5 w-3.5" />
        {t("header.settings")}
      </Link>
      {user?.role === "admin" && (
        <Link
          href="/admin"
          className={menuLinkClass}
          onClick={() => setAccountOpen(false)}
        >
          <DeimosIcon name="evidence" className="h-3.5 w-3.5" />
          {t("header.admin")}
        </Link>
      )}
      <div className="my-1 border-t border-[var(--rule)]" />
      <button
        type="button"
        className={menuLinkClass}
        onClick={() => {
          setAccountOpen(false);
          logout();
        }}
      >
        {t("header.logout")}
      </button>
    </>
  );

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[var(--rule)] bg-[var(--bg-surface)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-surface)]/75">
      <div className="page-container flex h-full items-center gap-5 lg:gap-7">
        <Logo compact />

        <nav className="hidden items-center gap-5 lg:gap-7 md:flex">
          <Link href="/ideas" className={navLinkClass}>
            {t("header.discover")}
          </Link>
          <Link href="/activity" className={navLinkClass}>
            {t("header.activity")}
          </Link>
          <Link href="/user/agents" className={navLinkClass}>
            {t("header.agents")}
          </Link>
        </nav>

        <SearchInput
          className="hidden w-full max-w-[460px] md:block"
          variant="editorial"
          placeholder={t("header.search")}
        />

        <div className="flex-1" />

        <Link
          href="/chat"
          className="hidden h-8 items-center gap-2 rounded-[var(--radius-btn)] bg-[var(--panel-inverse)] px-4 text-[12px] font-semibold text-white hover:opacity-90 lg:inline-flex"
        >
          {t("header.ask")}
          <span className="font-code text-[10px] text-white/60">⌘K</span>
        </Link>

        <Link href="/ideas/new" className="btn-primary h-8 px-4 text-[12px]">
          <span aria-hidden="true">+</span>
          {t("header.publish")}
        </Link>

        <div className="hidden md:block">
          <LanguageSwitcher />
        </div>

        {user && (
          <div ref={accountRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--rule)] bg-[var(--bg-subtle)] font-code text-[10px] text-[var(--ink)] hover:border-[var(--rule-strong)]"
              aria-label={t("header.accountMenu")}
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-1 w-52 overflow-hidden rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] py-1 shadow-[var(--shadow-float)]">
                {accountLinks}
              </div>
            )}
          </div>
        )}

        {!user && (
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="hidden font-code text-[10px] text-[var(--ink-soft)] hover:text-[var(--ink)] md:block"
          >
            {t("header.signIn")}
          </button>
        )}

        <div ref={menuRef} className="relative md:hidden">
          <button
            type="button"
            className="btn-icon"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t("header.menu")}
            aria-expanded={menuOpen}
          >
            <DeimosIcon name="menu" className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="fixed inset-x-3 top-14 overflow-hidden rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] py-1 shadow-[var(--shadow-float)]">
              <LanguageSwitcher mobile />
              <Link
                href="/search"
                className={menuLinkClass}
                onClick={() => setMenuOpen(false)}
              >
                <DeimosIcon name="semantic-search" className="h-3.5 w-3.5" />
                {t("header.search")}
              </Link>
              <Link
                href="/ideas"
                className={menuLinkClass}
                onClick={() => setMenuOpen(false)}
              >
                {t("header.discover")}
              </Link>
              <Link
                href="/chat"
                className={menuLinkClass}
                onClick={() => setMenuOpen(false)}
              >
                {t("header.ask")}
              </Link>
              <Link
                href="/activity"
                className={menuLinkClass}
                onClick={() => setMenuOpen(false)}
              >
                {t("header.activity")}
              </Link>
              {user ? (
                accountLinks
              ) : (
                <button
                  type="button"
                  className={menuLinkClass}
                  onClick={() => {
                    setMenuOpen(false);
                    openAuthModal();
                  }}
                >
                  {t("header.loginOrRegister")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
