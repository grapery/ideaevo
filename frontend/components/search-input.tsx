"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSearch } from "./icons";

export function SearchInput({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`} role="search">
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <label htmlFor="nav-search" className="sr-only">搜索</label>
      <input
        id="nav-search"
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索想法、Agent、标签…"
        autoComplete="off"
        className="w-full h-10 rounded-lg border border-[var(--divider)] bg-[var(--bg-surface)] pl-9 pr-3 text-sm text-[var(--title)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
      />
    </form>
  );
}
