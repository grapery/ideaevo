"use client";

import { AppLink as Link } from "./app-link";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect, useRef, useCallback } from "react";
import { Logo } from "./logo";
import { SearchInput } from "./search-input";
import { IconBell, IconUser } from "./icons";
import { notificationApi } from "@/lib/api-client";

export function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    if (!user) {
      setUnread(0);
      return;
    }
    try {
      const res = await notificationApi.unreadCount();
      setUnread(res.unread || 0);
    } catch {
      // ignore - likely not logged in or endpoint unavailable
    }
  }, [user]);

  useEffect(() => {
    void fetchUnread().catch(() => {});
    if (!user) return;
    const t = setInterval(() => {
      void fetchUnread().catch(() => {});
    }, 60 * 1000);
    const onFocus = () => {
      void fetchUnread().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchUnread, user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-canvas)]/90 backdrop-blur-md">
        <div className="mx-auto page-container">
        <div className="flex h-16 items-center gap-5">
          <Logo />
          <SearchInput className="hidden md:block flex-1 max-w-[320px] mx-4" />

          <div className="flex-1" />

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/ideas" className="text-sm text-[var(--text-secondary)] hover:text-[var(--primary)]">想法</Link>
            <Link href="/activity" className="text-sm text-[var(--text-secondary)] hover:text-[var(--primary)]">动态</Link>
            <Link href="/docs/mcp" className="text-sm text-[var(--text-secondary)] hover:text-[var(--primary)]">文档</Link>
          </nav>

          <Link
            href="/notifications"
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--primary)] ml-4 relative"
            aria-label="通知"
          >
            <IconBell />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--coral)] text-white text-[10px] font-semibold tabular-nums">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
                aria-label="账户菜单"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" width={48} height={48} className="h-12 w-12 rounded-full" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-[20px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)] py-1.5">
                  <Link
                    href="/notifications"
                    className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    onClick={() => setDropdownOpen(false)}
                  >
                    通知中心
                  </Link>
                  <Link
                    href={user ? `/users/${user.id}` : "/login"}
                    className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    onClick={() => setDropdownOpen(false)}
                  >
                    关注 / 粉丝
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    onClick={() => setDropdownOpen(false)}
                  >
                    我的面板
                  </Link>
                  <Link
                    href="/user/profile"
                    className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    onClick={() => setDropdownOpen(false)}
                  >
                    我的主页
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  >
                    退出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
              aria-label="登录"
            >
              <IconUser className="h-5 w-5" />
            </Link>
          )}

          <Link
            href="/ideas/new"
            className="hidden sm:inline-flex items-center gap-1.5 gradient-btn px-5 py-2.5 text-sm"
          >
            + 发布想法
          </Link>

          <button
            type="button"
            className="sm:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="菜单"
          >
            <svg className="h-6 w-6 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="sm:hidden pb-4 border-t border-[var(--divider)] pt-4 space-y-3">
            <SearchInput />
            <Link href="/ideas" className="block text-sm text-[var(--body)]" onClick={() => setMenuOpen(false)}>
              浏览想法
            </Link>
            <Link href="/activity" className="block text-sm text-[var(--body)]" onClick={() => setMenuOpen(false)}>
              动态
            </Link>
            <Link href="/docs/mcp" className="block text-sm text-[var(--body)]" onClick={() => setMenuOpen(false)}>
              MCP 文档
            </Link>
            <Link href="/chat" className="block text-sm text-[var(--body)]" onClick={() => setMenuOpen(false)}>
              对话
            </Link>
            {user && (
              <Link href="/notifications" className="block text-sm text-[var(--body)]" onClick={() => setMenuOpen(false)}>
                通知
              </Link>
            )}
            <Link href="/ideas/new" className="block text-sm text-[var(--primary)] font-medium" onClick={() => setMenuOpen(false)}>
              + 发布想法
            </Link>
            {!user && (
              <Link href="/login" className="block text-sm text-[var(--primary)]" onClick={() => setMenuOpen(false)}>
                登录
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
