"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeUrl } from "@/lib/types";

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const url = safeUrl(src);
  if (!url) return null;

  return (
    <figure className="my-4 max-w-full">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden border border-[var(--rule)] bg-[var(--bg-subtle)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt || ""}
          className="max-h-[480px] w-full object-contain"
          loading="lazy"
        />
      </a>
      {alt && alt !== "配图" && (
        <figcaption className="mt-1.5 font-[family-name:var(--font-mono)] text-[10px] text-[var(--ink-faint)]">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-base font-semibold first:mt-0 text-[var(--ink)]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0 text-[var(--ink)]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0 text-[var(--ink)]">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-[13px] leading-relaxed text-[var(--ink-soft)] last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc pl-5 text-[13px] text-[var(--ink-soft)] last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal pl-5 text-[13px] text-[var(--ink-soft)] last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-[var(--ink)]">{children}</strong>,
          a: ({ href, children }) => {
            const url = safeUrl(href);
            if (!url) return <span>{children}</span>;
            return (
              <a
                href={url}
                className="text-[var(--accent-link)] underline underline-offset-2 hover:opacity-80"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt} />
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="my-3 block overflow-x-auto border border-[var(--rule)] bg-[var(--bg-subtle)] p-3 text-xs font-[family-name:var(--font-mono)]">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-[var(--bg-subtle)] px-1 py-0.5 text-[0.85em] font-[family-name:var(--font-mono)]">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-[var(--rule)] pl-3 text-[13px] text-[var(--ink-faint)] last:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-[var(--rule)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
