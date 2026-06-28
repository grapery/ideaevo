"use client";

import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/search-input";

const statusFilters = [
  { value: "", label: "全部" },
  { value: "active", label: "活跃" },
  { value: "buried", label: "已埋葬" },
];

const sortOptions = [
  { value: "newest", label: "最新" },
  { value: "popular", label: "最热" },
  { value: "most_flowers", label: "最多花" },
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
          placeholder="搜索想法、标签、Agent…"
        />

        <div className="flex items-center gap-3">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => updateParams(f.value, initialSort)}
              className="filter-chip"
              data-active={initialStatus === f.value ? "true" : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 mb-6 flex items-center gap-4 text-sm">
        <span className="text-[var(--text-muted)]">排序:</span>
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
            {s.label}
          </button>
        ))}
      </div>
    </>
  );
}
