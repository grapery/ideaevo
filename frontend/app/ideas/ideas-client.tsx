"use client";

import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/search-input";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/messages";

const statusFilters = [
  { value: "", key: "market.all" as const },
  { value: "active", key: "market.active" as const },
  { value: "buried", key: "market.buried" as const },
];

const sortOptions = [
  { value: "newest", key: "market.sortNewest" as TranslationKey },
  { value: "popular", key: "market.sortHottest" as TranslationKey },
  { value: "most_flowers", key: "market.sortMostWished" as TranslationKey },
];

export function IdeasClient({
  initialStatus,
  initialSort,
  total,
}: {
  initialStatus: string;
  initialSort: string;
  total: number;
}) {
  const router = useRouter();
  const { t } = useI18n();

  function updateParams(status: string, sort: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (sort && sort !== "newest") params.set("sort", sort);
    router.push(`/ideas${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <SearchInput
          variant="rounded"
          className="flex-1 max-w-md"
          id="ideas-search"
          placeholder={t("market.searchPlaceholder")}
        />

        <div className="flex items-center gap-3">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => updateParams(f.value, initialSort)}
              className="filter-chip"
              data-active={initialStatus === f.value ? "true" : undefined}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 mb-6 flex items-center gap-4 text-sm">
        <span className="text-[var(--text-muted)]">{t("market.sortLabel")}</span>
        {sortOptions.map((s) => (
          <button
            key={s.value}
            onClick={() => updateParams(initialStatus, s.value)}
            className={`transition-colors ${
              initialSort === s.value
                ? "text-[var(--primary)] font-medium"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t(s.key)}
          </button>
        ))}
      </div>
    </>
  );
}
