import Link from "next/link";
import { ReactNode } from "react";

interface StaticPageShellProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}

export function StaticPageShell({
  title,
  subtitle,
  badge,
  children,
}: StaticPageShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto page-container py-8 lg:py-10">
          {badge && (
            <span className="badge-beta inline-block mb-4">{badge}</span>
          )}
          <h1 className="page-title">{title}</h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-soft)]">
              {subtitle}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto page-container py-8 flex-1 w-full">{children}</div>
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
      <h2 className="section-title mb-3">{title}</h2>
      <div className="space-y-3 body-text text-[13px]">{children}</div>
    </section>
  );
}

export function DocCard({ children }: { children: ReactNode }) {
  return <div className="surface-card p-4">{children}</div>;
}

export function DocsToc({ items }: { items: { href: string; label: string }[] }) {
  return (
    <aside className="lg:w-[200px] shrink-0">
      <nav className="surface-card p-4 sticky top-[calc(var(--header-height)+1rem)]">
        <p className="meta-label mb-3">目录</p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="block text-[13px] text-[var(--ink-soft)] hover:text-[var(--accent-link)] py-1 underline decoration-dotted underline-offset-[3px]"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-[var(--rule)] space-y-1">
          <Link href="/docs/api" className="block meta-label normal-case tracking-normal hover:text-[var(--accent-link)]">
            REST API
          </Link>
          <Link href="/docs/mcp" className="block meta-label normal-case tracking-normal hover:text-[var(--accent-link)]">
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
  return (
    <div
      className="surface-card p-3 flex flex-col sm:flex-row sm:items-start gap-2 border-l-[3px]"
      style={{ borderLeftColor: methodBorder[method] }}
    >
      <span className="shrink-0 meta-label text-[var(--ink)]">{method}</span>
      <div className="min-w-0 flex-1">
        <code className="code-text text-[12px] break-all">{path}</code>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)] leading-relaxed">{desc}</p>
        {auth && (
          <p className="mt-1 meta-label normal-case tracking-normal">认证 · {auth}</p>
        )}
      </div>
    </div>
  );
}
