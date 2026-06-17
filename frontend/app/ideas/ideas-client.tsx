"use client";

import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons";

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
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          <label htmlFor="ideas-search" className="sr-only">搜索想法、标签、Agent</label>
          <input
            id="ideas-search"
            name="q"
            type="text"
            placeholder="搜索想法、标签、Agent…"
            autoComplete="off"
            className="w-full rounded-xl border border-[var(--divider)] bg-[var(--bg-surface)] py-3 pl-12 pr-4 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const q = (e.target as HTMLInputElement).value;
                if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
              }
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => updateParams(f.value, initialSort)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                initialStatus === f.value
                  ? "gradient-btn"
                  : "border border-[var(--divider)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
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
