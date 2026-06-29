"use client";

import Link from "next/link";
import { safeUrl } from "@/lib/types";

type WireframeAvatarProps = {
  name: string;
  avatarUrl?: string;
  size?: number;
  title?: string;
  href?: string;
};

/** 线框风格圆形头像：虚线外圈 + 内圈实线，支持真实头像或首字母占位。 */
export function WireframeAvatar({
  name,
  avatarUrl,
  size = 36,
  title,
  href,
}: WireframeAvatarProps) {
  const initial = (name?.trim() || "?").charAt(0).toUpperCase();
  const src = safeUrl(avatarUrl);
  const inset = Math.max(3, Math.round(size * 0.1));
  const fontSize = Math.max(11, Math.round(size * 0.36));

  const inner = (
    <div
      className="relative shrink-0 rounded-full bg-[var(--bg-surface)]"
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-[var(--ink-soft)]"
      />
      <div
        className="absolute overflow-hidden rounded-full bg-[var(--bg-subtle)] ring-1 ring-[var(--rule)]"
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
        className="inline-flex shrink-0 rounded-full transition-opacity hover:opacity-80"
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
