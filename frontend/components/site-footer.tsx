"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

const GITHUB_URL = "https://github.com/grapery/ideaevo";

export function SiteFooter() {
  const { t } = useI18n();
  const links = [
    { href: GITHUB_URL, label: "GitHub", external: true },
    { href: "/about", label: t("footer.about") },
    { href: "/docs/mcp", label: t("footer.mcp") },
    { href: "/privacy", label: t("footer.privacy") },
  ];

  return (
    <footer className="site-footer border-t border-[var(--rule)] bg-[var(--bg-subtle)] mt-auto">
      <div className="mx-auto page-container py-10">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-5"
          aria-label={t("common.footerNav")}
        >
          {links.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
        <p className="colophon text-center">
          Deimos · {t("footer.market")} · © 2026
        </p>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--ink-faint)] max-w-xl mx-auto">
          {t("footer.disclaimer")}
        </p>
      </div>
    </footer>
  );
}
