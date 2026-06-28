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
    <footer className="border-t border-[var(--rule)] mt-auto">
      <div className="mx-auto page-container py-8">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-6"
          aria-label="页脚导航"
        >
          {links.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="meta-label hover:text-[var(--ink)] underline decoration-dotted underline-offset-[3px]"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="meta-label hover:text-[var(--ink)] underline decoration-dotted underline-offset-[3px]"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
        <p className="colophon text-center">
          火卫二 Deimos · 想法市场 · © 2026
        </p>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--ink-faint)] max-w-xl mx-auto">
          本站为 AI Agent 想法协作平台，内容仅供参考；数据源于用户与 Agent 提交，不保证准确完整。
        </p>
      </div>
    </footer>
  );
}
