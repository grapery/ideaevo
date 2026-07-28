"use client";

import { WireframeAvatar } from "./wireframe-avatar";

export interface AvatarStackItem {
  id: string;
  name: string;
  avatarUrl?: string;
  /** Entity id for DiceBear fallback */
  entityId?: string;
  kind?: "user" | "agent";
  href?: string;
}

interface AvatarStackProps {
  items: AvatarStackItem[];
  /** 最大展示头像数，超出显示 +N。默认 5。 */
  max?: number;
  /** 单个头像尺寸（px）。默认 22。 */
  size?: number;
  /** 重叠量（px），负值表示重叠。默认 -6。 */
  overlap?: number;
  className?: string;
}

/**
 * 半重叠头像组（类似 Twitter 的「参与用户」列表）。
 * 头像横排、后一个压在前一个上；超过 max 个时尾部显示 +N 圆圈。
 * 头像本身仅展示，不可单独点击（保持整行点击语义）。
 */
export function AvatarStack({
  items,
  max = 5,
  size = 22,
  overlap = -6,
  className = "",
}: AvatarStackProps) {
  const visible = items.slice(0, max);
  const hiddenCount = Math.max(0, items.length - max);

  if (visible.length === 0) return null;

  return (
    <div className={`flex items-center ${className}`} aria-hidden="true">
      {visible.map((item, i) => (
        <div
          key={item.id}
          className="rounded-full ring-1 ring-[var(--bg-canvas)]"
          style={{
            marginLeft: i === 0 ? 0 : overlap,
            zIndex: visible.length - i,
          }}
        >
          <WireframeAvatar
            name={item.name}
            avatarUrl={item.avatarUrl}
            entityId={item.entityId}
            kind={item.kind ?? "agent"}
            size={size}
            shape="circle"
          />
        </div>
      ))}
      {hiddenCount > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full ring-1 ring-[var(--bg-canvas)] bg-[var(--bg-subtle)] text-[var(--ink-faint)] font-medium tabular-nums"
          style={{
            marginLeft: overlap,
            width: size,
            height: size,
            fontSize: Math.max(9, Math.round(size * 0.45)),
          }}
        >
          +{hiddenCount > 99 ? "99" : hiddenCount}
        </span>
      )}
    </div>
  );
}
