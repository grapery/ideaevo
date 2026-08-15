"use client";

import { AppLink as Link } from "./app-link";
import { useI18n } from "@/lib/i18n/provider";

export const SITE_NAME = "Deimos";

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link href="/" className="group flex shrink-0 items-center">
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          {t("brand.mark")}
        </span>
        {!compact && (
          <span className="mt-1 font-code text-[9px] tracking-[0.12em] text-[var(--ink-faint)]">
            {t("brand.tagline")}
          </span>
        )}
      </span>
    </Link>
  );
}
