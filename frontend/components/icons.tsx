import { DeimosIcon } from "./deimos-icon";

type IconProps = { className?: string };

// 全站图标统一走 DeimosIcon（Ardot Ic 设计 + 补充线框图标），mask 染色。
// 除 IconDeimos（品牌图形）保留专用 SVG 外，其余均映射到 deimos 图标库。

/** 火卫二 Deimos — 火星、潮汐弧与卫星（品牌图形） */
export function IconDeimos({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24.5" cy="7.5" r="6.5" fill="currentColor" opacity="0.22" />
      <path
        d="M3 15.5C3 9.5 8.5 5 14 5C19.5 5 25 9.5 25 15.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M5 20C5 15.5 9 12.5 14 12.5C19 12.5 23 15.5 23 20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M7 24C7 20.5 10 18.5 14 18.5C18 18.5 21 20.5 21 24"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <ellipse cx="14" cy="17.5" rx="5.2" ry="4.6" fill="currentColor" />
      <ellipse cx="12.2" cy="16.2" rx="1.4" ry="1.1" fill="var(--bg-canvas, #fff)" opacity="0.28" />
      <circle cx="15.8" cy="18.6" r="0.7" fill="var(--bg-canvas, #fff)" opacity="0.22" />
    </svg>
  );
}

export function IconLeaf({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="leaf" className={className} />;
}

export function IconHeart({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="heart" className={className} />;
}

export function IconFlower({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="flower" className={className} />;
}

export function IconGitFork({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="fork" className={className} />;
}

export function IconMessage({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="comment" className={className} />;
}

export function IconShare({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="share" className={className} />;
}

export function IconBookmark({ className = "h-3.5 w-3.5" }: IconProps & { filled?: boolean }) {
  // filled 语义由父容器激活态颜色体现（如 CountButton active tone）。
  return <DeimosIcon name="bookmark" className={className} />;
}

export function IconShield({ className = "h-4 w-4" }: IconProps) {
  return <DeimosIcon name="shield" className={className} />;
}

export function IconSearch({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="search" className={className} />;
}

export function IconBell({ className = "h-4 w-4" }: IconProps) {
  return <DeimosIcon name="bell" className={className} />;
}

export function IconFlame({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="sparkles" className={className} />;
}

export function IconUser({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="profile" className={className} />;
}

export function IconLock({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="lock" className={className} />;
}

export function IconKey({ className = "h-3.5 w-3.5" }: IconProps) {
  return <DeimosIcon name="key" className={className} />;
}

export function IconSend({ className = "h-4 w-4" }: IconProps) {
  return <DeimosIcon name="send" className={className} />;
}
