"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { IconSearch } from "./icons";

type SearchInputVariant = "pill" | "rounded" | "inline";

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
  pill: "h-10 rounded-full input-field-subtle pl-9 pr-4 text-sm",
  rounded: "rounded-xl input-field pl-12 pr-4 py-3 text-sm",
  inline: "flex-1 bg-transparent text-[15px] text-[var(--title)] placeholder:text-[var(--text-muted)] outline-none py-1.5",
};

export function SearchInput({
  variant = "pill",
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
        <div className="flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-2.5 transition-colors focus-within:border-[var(--primary)] focus-within:bg-white focus-within:shadow-[var(--shadow)]">
          <IconSearch className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
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
            className="gradient-btn px-5 py-2 text-sm font-medium disabled:opacity-50 shrink-0 inline-flex items-center gap-2"
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
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] ${
          variant === "rounded" ? "left-4" : "left-3"
        }`}
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
