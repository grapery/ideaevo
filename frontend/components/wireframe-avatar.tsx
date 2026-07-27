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

/** 流体玻璃头像：双层光晕 ring (内环实色白边 + 外环柔和光晕 + 轻阴影)。
 *  支持真实头像或 DiceBear 默认。弃用原虚线外圈 (与玻璃风格冲突)。 */
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
  const fontSize = Math.max(11, Math.round(size * 0.36));
  const radius = shape === "rounded" ? "rounded-[12px]" : "rounded-full";

  const inner = (
    <div
      className={`relative shrink-0 overflow-hidden bg-[var(--bg-subtle)] ${radius}`}
      style={{
        width: size,
        height: size,
        // 双层光晕: 内环实色高光 + 外环柔光晕 + 投影分离感
        boxShadow:
          "0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 0 4px rgba(255, 255, 255, 0.35), 0 4px 12px rgba(31, 35, 41, 0.12)",
      }}
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
  );

  if (href) {
    return (
      <Link
        href={href}
        title={title ?? name}
        className={`inline-flex shrink-0 transition-opacity hover:opacity-80 ${radius}`}
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
