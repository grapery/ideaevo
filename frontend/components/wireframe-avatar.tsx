"use client";

import { safeUrl } from "@/lib/types";

type WireframeAvatarProps = {
  name: string;
  avatarUrl?: string;
  size?: number;
  title?: string;
};

/** 线框风格圆形头像（虚线描边）。 */
export function WireframeAvatar({
  name,
  avatarUrl,
  size = 36,
  title,
}: WireframeAvatarProps) {
  const initial = (name?.trim() || "?").charAt(0).toUpperCase();
  const src = safeUrl(avatarUrl);

  return (
    <div
      title={title ?? name}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--ink-faint)] bg-[var(--bg-canvas)] shadow-[inset_0_0_0_1px_var(--divider)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="font-semibold text-[var(--primary)]"
          style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
