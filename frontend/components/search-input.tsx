"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { IconSearch } from "./icons";

type SearchInputVariant = "pill" | "rounded" | "inline" | "editorial";

type SearchInputProps = {
  variant?: SearchInputVariant;
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (query: string) => void;
  navigateOnSubmit?: boolean;
  submitLabel?: string;
  loading?: boolean;
  autoFocus?: boolean;
};

const variantClasses: Record<SearchInputVariant, string> = {
  pill: "h-8 input-field-subtle pl-8 pr-3 text-[13px]",
  rounded: "input-field pl-9 pr-3 py-2 text-[13px]",
  editorial: "h-8 input-field pl-8 pr-3 text-[13px]",
  inline: "flex-1 bg-transparent text-[13px] text-[var(--title)] placeholder:text-[var(--text-muted)] outline-none py-1",
};

export function SearchInput({
  variant = "editorial",
  className = "",
  id = "nav-search",
  name = "q",
  placeholder = "搜索想法…",
  value: controlledValue,
  defaultValue = "",
  onChange,
  onSubmit,
  navigateOnSubmit = true,
  submitLabel,
  loading = false,
  autoFocus,
}: SearchInputProps) {
  const router = useRouter();
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const query = isControlled ? controlledValue : internal;

  function setQuery(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (onSubmit) {
      onSubmit(trimmed);
    } else if (navigateOnSubmit) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  if (variant === "inline" && submitLabel) {
    return (
      <form onSubmit={handleSubmit} className={className}>
        <div className="flex items-center gap-2 border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-1.5 focus-within:border-[var(--ink)]">
          <IconSearch className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <label htmlFor={id} className="sr-only">{placeholder}</label>
          <input
            id={id}
            name={name}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            className={variantClasses.inline}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-outline btn-sm disabled:opacity-50 shrink-0"
          >
            {loading ? "搜索中…" : submitLabel}
          </button>
        </div>
      </form>
    );
  }

  const inputEl = (
    <>
      <IconSearch
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-2.5 h-3.5 w-3.5 text-[var(--text-muted)]"
        aria-hidden="true"
      />
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <input
        id={id}
        type="search"
        name={name}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            runSearch((e.target as HTMLInputElement).value);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={`w-full ${variantClasses[variant]}`}
      />
    </>
  );

  if (navigateOnSubmit && !onSubmit) {
    return (
      <form onSubmit={handleSubmit} className={`relative ${className}`} role="search">
        {inputEl}
      </form>
    );
  }

  return <div className={`relative ${className}`}>{inputEl}</div>;
}
