"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageSwitcher({
  mobile = false,
  dark = false,
}: {
  mobile?: boolean;
  dark?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();

  const options: Array<{ value: Locale; label: string }> = [
    { value: "zh-CN", label: t("language.zh") },
    { value: "en", label: t("language.en") },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-[var(--radius-btn)] border p-0.5 ${
        dark
          ? "border-white/15 bg-black/40"
          : "border-[var(--rule)] bg-[var(--bg-surface)]"
      } ${mobile ? "mx-3 my-2" : ""}`}
      role="group"
      aria-label={t("common.switchLanguage")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLocale(option.value)}
          aria-pressed={locale === option.value}
          className={`rounded-[3px] px-2 py-1 font-code text-[10px] transition-colors ${
            locale === option.value
              ? dark
                ? "bg-[var(--bg-surface)] text-[var(--panel-inverse)]"
                : "bg-[var(--panel-inverse)] text-white"
              : dark
                ? "text-white/45 hover:text-white"
                : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
          }`}
        >
          {option.value === "zh-CN" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}
