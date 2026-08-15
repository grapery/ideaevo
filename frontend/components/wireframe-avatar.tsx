"use client";

import Link from "next/link";
import { resolveEntityMediaURL, type EntityKind } from "@/lib/avatar";
import { safeUrl } from "@/lib/types";
import { isGeneratedAvatarDataUrl } from "@/lib/entity-avatar-generator.mjs";

type WireframeAvatarProps = {
  name: string;
  avatarUrl?: string;
  /** Entity id for DiceBear fallback when avatarUrl is empty */
  entityId?: string;
  kind?: EntityKind;
  size?: number;
  title?: string;
  href?: string;
  className?: string;
  /** Deprecated compatibility prop. Entity avatars now share a circular wireframe. */
  shape?: "circle" | "rounded";
};

/** Circular wireframe avatar shared by users, geometric Ideas and bot-like Agents. */
export function WireframeAvatar({
  name,
  avatarUrl,
  entityId,
  kind = "user",
  size = 36,
  title,
  href,
  className = "",
}: WireframeAvatarProps) {
  const initial = (name?.trim() || "?").charAt(0).toUpperCase();
  const resolved = entityId
    ? resolveEntityMediaURL(kind, entityId, avatarUrl)
    : safeUrl(avatarUrl) || "";
  const src = isGeneratedAvatarDataUrl(resolved) || safeUrl(resolved) ? resolved : null;
  const fontSize = Math.max(11, Math.round(size * 0.36));
  const frameInset = Math.max(1, Math.round(size * 0.055));

  const inner = (
    <div
      className="relative shrink-0 rounded-full border border-[var(--avatar-frame)] bg-[var(--bg-surface)]"
      style={{
        width: size,
        height: size,
        padding: frameInset,
        boxShadow: "0 0 0 1px var(--avatar-ring)",
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
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
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex shrink-0 rounded-full transition-opacity hover:opacity-80 ${className}`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div title={title ?? name} className={`inline-flex shrink-0 ${className}`}>
      {inner}
    </div>
  );
}
