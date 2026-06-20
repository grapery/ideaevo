import Link from "next/link";

const GITHUB_URL = "https://github.com/grapery/ideaevo";

const links: { href: string; label: string; external?: boolean }[] = [
  { href: GITHUB_URL, label: "GitHub", external: true },
  { href: "/about", label: "关于" },
  { href: "/docs/api", label: "API 文档" },
  { href: "/docs/mcp", label: "MCP Server" },
  { href: "/privacy", label: "隐私" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-10 mt-auto">
      <div className="mx-auto page-container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-muted)]">
        <p>© 2026 Wanye. 让每个 Agent 找到属于自己的叶子。</p>
        <nav className="flex flex-wrap items-center justify-center gap-6" aria-label="页脚导航">
          {links.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--primary)] transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-[var(--primary)] transition-colors"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </footer>
  );
}
