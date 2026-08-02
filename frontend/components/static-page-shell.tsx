"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface StaticPageShellProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
  /** 正文是否限制阅读宽度（about / privacy） */
  readingWidth?: boolean;
}

/**
 * Docs / About / Privacy 静态页外壳。
 * 垂直节奏用 page-pad-docs（略松于 app 页），标题保留文档级 .page-title。
 */
export function StaticPageShell({
  title,
  subtitle,
  badge,
  children,
  readingWidth = false,
}: StaticPageShellProps) {
  return (
    <div className="page-shell-full flex flex-col">
      <section className="border-b border-[var(--rule)] bg-[var(--bg-surface)]">
        <div className="page-container page-pad-docs">
          {badge && <span className="badge-beta mb-3 inline-block">{badge}</span>}
          <h1 className="page-title">{title}</h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--ink-soft)] sm:text-[16px] sm:leading-7">
              {subtitle}
            </p>
          )}
        </div>
      </section>

      <div className="page-container page-pad-docs w-full flex-1">
        {readingWidth ? <div className="page-reading space-y-10">{children}</div> : children}
      </div>
    </div>
  );
}

interface DocSectionProps {
  id?: string;
  title: string;
  children: ReactNode;
}

export function DocSection({ id, title, children }: DocSectionProps) {
  return (
    <section id={id} className="mb-10 last:mb-0">
      <h2 className="section-title mb-4">{title}</h2>
      <div className="space-y-3 body-text">{children}</div>
    </section>
  );
}

export function DocCard({ children }: { children: ReactNode }) {
  return <div className="surface-card p-4">{children}</div>;
}

export function DocsToc({ items }: { items: { href: string; label: string }[] }) {
  const { t } = useI18n();
  return (
    <aside className="w-full shrink-0 lg:w-[200px]">
      <nav className="surface-card sticky top-[calc(var(--header-height)+1rem)] p-4">
        <p className="meta-label mb-3">{t("common.toc")}</p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="block py-1 text-[13px] leading-5 text-[var(--ink-soft)] underline decoration-dotted underline-offset-[3px] hover:text-[var(--accent-link)]"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-[var(--rule)] pt-4">
          <Link
            href="/docs/mcp"
            className="meta-label block normal-case tracking-normal hover:text-[var(--accent-link)]"
          >
            MCP Server
          </Link>
        </div>
      </nav>
    </aside>
  );
}

interface ApiEndpointProps {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  auth?: string;
  desc: string;
}

const methodBorder: Record<string, string> = {
  GET: "var(--accent-link)",
  POST: "var(--accent-live)",
  PATCH: "var(--accent-amber)",
  DELETE: "var(--accent-stamp)",
};

export function ApiEndpoint({ method, path, auth, desc }: ApiEndpointProps) {
  const { t } = useI18n();
  return (
    <div
      className="surface-card flex flex-col gap-2 border-l-[3px] p-3 sm:flex-row sm:items-start"
      style={{ borderLeftColor: methodBorder[method] }}
    >
      <span className="meta-label shrink-0 text-[var(--ink)]">{method}</span>
      <div className="min-w-0 flex-1">
        <code className="code-text break-all text-[12px]">{path}</code>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">{desc}</p>
        {auth && (
          <p className="meta-label mt-1 normal-case tracking-normal">
            {t("common.authLabel", { auth })}
          </p>
        )}
      </div>
    </div>
  );
}
