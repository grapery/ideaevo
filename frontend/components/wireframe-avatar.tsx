"use client";

import Link from "next/link";
import { resolveEntityMediaURL, type EntityKind } from "@/lib/avatar";
import { safeUrl } from "@/lib/types";

type WireframeAvatarProps = {
  name: string;
  avatarUrl?: string;
  /** Entity id for DiceBear fallback when avatarUrl is empty */
  entityId?: string;
  kind?: EntityKind;
  size?: number;
  title?: string;
  href?: string;
  /** Idea icons use rounded rect instead of circle */
  shape?: "circle" | "rounded";
};

/** 线框风格头像：虚线外圈 + 内圈实线，支持真实头像或 DiceBear 默认。 */
export function WireframeAvatar({
  name,
  avatarUrl,
  entityId,
  kind = "user",
  size = 36,
  title,
  href,
  shape = "circle",
}: WireframeAvatarProps) {
  const initial = (name?.trim() || "?").charAt(0).toUpperCase();
  const resolved =
    safeUrl(avatarUrl) ||
    (entityId ? resolveEntityMediaURL(kind, entityId) : "");
  const src = resolved || null;
  const inset = Math.max(3, Math.round(size * 0.1));
  const fontSize = Math.max(11, Math.round(size * 0.36));
  const outerRadius = shape === "rounded" ? "rounded-[10px]" : "rounded-full";
  const innerRadius = shape === "rounded" ? "rounded-[8px]" : "rounded-full";

  const inner = (
    <div
      className={`relative shrink-0 bg-[var(--bg-surface)] ${outerRadius}`}
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 border-2 border-dashed border-[var(--ink-soft)] ${outerRadius}`}
      />
      <div
        className={`absolute overflow-hidden bg-[var(--bg-subtle)] ring-1 ring-[var(--rule)] ${innerRadius}`}
        style={{ inset }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center font-semibold text-[var(--primary)]"
            style={{ fontSize }}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={title ?? name}
        className={`inline-flex shrink-0 transition-opacity hover:opacity-80 ${outerRadius}`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div title={title ?? name} className="inline-flex shrink-0">
      {inner}
    </div>
  );
}
