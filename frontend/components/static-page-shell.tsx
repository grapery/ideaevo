import Link from "next/link";
import { ReactNode } from "react";

interface StaticPageShellProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
  heroGradient?: boolean;
}

export function StaticPageShell({
  title,
  subtitle,
  badge,
  children,
  heroGradient = false,
}: StaticPageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col">
      <section
        className={heroGradient ? "text-white border-b border-[var(--border)]" : "border-b border-[var(--border)]"}
        style={
          heroGradient
            ? {
                background:
                  "linear-gradient(160deg, var(--accent-moss) 0%, #3d5840 55%, var(--accent-ochre) 100%)",
              }
            : undefined
        }
      >
        <div className="mx-auto page-container py-8 lg:py-10">
          {badge && (
            <span
              className={`inline-block mb-4 rounded-full px-3 py-1 text-xs font-medium ${
                heroGradient ? "bg-white/15" : "badge-beta"
              }`}
            >
              {badge}
            </span>
          )}
          <h1 className={`page-title ${heroGradient ? "text-white" : ""}`}>{title}</h1>
          {subtitle && (
            <p
              className={`mt-3 max-w-2xl text-[17px] leading-relaxed ${
                heroGradient ? "text-white/85" : "text-[var(--text-secondary)]"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto page-container py-10 flex-1 w-full">{children}</div>
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
    <section id={id} className="mb-12 last:mb-0">
      <h2 className="section-title mb-4">{title}</h2>
      <div className="space-y-4 body-text">{children}</div>
    </section>
  );
}

export function DocCard({ children }: { children: ReactNode }) {
  return <div className="surface-card p-5">{children}</div>;
}

export function DocsToc({ items }: { items: { href: string; label: string }[] }) {
  return (
    <aside className="lg:w-[200px] shrink-0">
      <div className="panel-card sticky top-24">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">
          目录
        </h3>
        <nav className="space-y-2 text-sm">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block text-[var(--text-secondary)] hover:text-[var(--primary)] py-0.5 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-5 pt-5 border-t border-[var(--border)] space-y-2 text-sm">
          <Link href="/docs/api" className="block text-[var(--text-muted)] hover:text-[var(--primary)]">
            REST API
          </Link>
          <Link href="/docs/mcp" className="block text-[var(--text-muted)] hover:text-[var(--primary)]">
            MCP Server
          </Link>
        </div>
      </div>
    </aside>
  );
}

interface ApiEndpointProps {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  auth?: string;
  desc: string;
}

const methodColors: Record<string, string> = {
  GET: "bg-[var(--primary-soft)] text-[var(--primary)]",
  POST: "bg-[var(--teal-soft)] text-[var(--accent-blue)]",
  PATCH: "bg-[var(--primary-soft)] text-[var(--accent-ochre)]",
  DELETE: "bg-[var(--coral-soft)] text-[var(--coral)]",
};

export function ApiEndpoint({ method, path, auth, desc }: ApiEndpointProps) {
  return (
    <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <span
        className={`shrink-0 inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${methodColors[method]}`}
      >
        {method}
      </span>
      <div className="min-w-0 flex-1">
        <code className="code-text text-sm break-all">{path}</code>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
        {auth && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">认证：{auth}</p>
        )}
      </div>
    </div>
  );
}
