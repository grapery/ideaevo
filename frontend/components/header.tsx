"use client";

import { AppLink as Link } from "./app-link";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect, useRef, useCallback } from "react";
import { Logo } from "./logo";
import { SearchInput } from "./search-input";
import { IconBell, IconUser } from "./icons";
import { notificationApi } from "@/lib/api-client";

const navLinkClass =
  "meta-label hover:text-[var(--ink)] transition-colors underline-offset-[3px] hover:underline decoration-dotted";

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
      // ignore
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
    <header className="sticky top-0 z-50 border-b border-[var(--rule)] bg-[var(--bg-canvas)]/96 backdrop-blur-sm">
      <div className="mx-auto page-container">
        <div className="flex h-10 items-center gap-4">
          <Logo compact />
          <SearchInput className="hidden md:block flex-1 max-w-[280px]" variant="editorial" />

          <div className="flex-1" />

          <nav className="hidden md:flex items-center gap-5">
            <Link href="/ideas" className={navLinkClass}>想法</Link>
            <Link href="/chat" className={navLinkClass}>对话</Link>
            <Link href="/activity" className={navLinkClass}>动态</Link>
            <Link href="/docs/mcp" className={navLinkClass}>文档</Link>
          </nav>

          <Link
            href="/notifications"
            className="btn-icon hidden sm:inline-flex relative ml-2"
            aria-label="通知"
          >
            <IconBell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center border border-[var(--coral)] bg-[var(--bg-surface)] text-[var(--coral)] text-[8px] font-medium tabular-nums">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="btn-icon"
                aria-label="账户菜单"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-medium font-[family-name:var(--font-mono)]">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-44 border border-[var(--rule)] bg-[var(--bg-surface)] py-1 shadow-[var(--shadow-lg)]">
                  <Link
                    href="/notifications"
                    className="block px-3 py-1.5 text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                    onClick={() => setDropdownOpen(false)}
                  >
                    通知中心
                  </Link>
                  <Link
                    href={`/users/${user.id}`}
                    className="block px-3 py-1.5 text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                    onClick={() => setDropdownOpen(false)}
                  >
                    关注 / 粉丝
                  </Link>
                  <Link
                    href="/user/profile"
                    className="block px-3 py-1.5 text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
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
                    className="w-full text-left px-3 py-1.5 text-[13px] text-[var(--ink-soft)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                  >
                    退出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn-icon hidden sm:inline-flex" aria-label="登录">
              <IconUser className="h-4 w-4" />
            </Link>
          )}

          <Link href="/chat" className="hidden sm:inline-flex btn-outline btn-sm">
            + 对话创建
          </Link>

          <button
            type="button"
            className="btn-icon sm:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="菜单"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="sm:hidden pb-3 border-t border-[var(--rule)] pt-3 space-y-2">
            <SearchInput variant="editorial" />
            <Link href="/ideas" className="block text-[13px] text-[var(--ink-soft)] py-1" onClick={() => setMenuOpen(false)}>
              浏览想法
            </Link>
            <Link href="/activity" className="block text-[13px] text-[var(--ink-soft)] py-1" onClick={() => setMenuOpen(false)}>
              动态
            </Link>
            <Link href="/docs/mcp" className="block text-[13px] text-[var(--ink-soft)] py-1" onClick={() => setMenuOpen(false)}>
              MCP 文档
            </Link>
            <Link href="/chat" className="block text-[13px] text-[var(--ink-soft)] py-1" onClick={() => setMenuOpen(false)}>
              对话
            </Link>
            {user && (
              <Link href="/notifications" className="block text-[13px] text-[var(--ink-soft)] py-1" onClick={() => setMenuOpen(false)}>
                通知
              </Link>
            )}
            <Link href="/chat" className="inline-flex btn-outline btn-sm mt-1" onClick={() => setMenuOpen(false)}>
              + 对话创建
            </Link>
            {!user && (
              <Link href="/login" className="block text-[13px] text-[var(--accent-link)] py-1" onClick={() => setMenuOpen(false)}>
                登录
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
