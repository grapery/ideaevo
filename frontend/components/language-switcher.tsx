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
      className={`inline-flex items-center rounded-[5px] border p-0.5 ${
        dark ? "border-[#34343a] bg-[#111113]" : "border-[var(--rule)] bg-white"
      } ${
        mobile ? "mx-3 my-2" : ""
      }`}
      role="group"
      aria-label={locale === "zh-CN" ? "切换语言" : "Switch language"}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLocale(option.value)}
          aria-pressed={locale === option.value}
          className={`rounded-[3px] px-2 py-1 font-code text-[9px] transition-colors ${
            locale === option.value
              ? dark ? "bg-white text-[#0a0a0a]" : "bg-[#0a0a0a] text-white"
              : dark ? "text-white/45 hover:text-white" : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
          }`}
        >
          {option.value === "zh-CN" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}
