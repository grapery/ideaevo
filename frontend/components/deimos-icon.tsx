import type { CSSProperties } from "react";

/** Deimos icon names aligned with iOS `DeimosIcon` / Ardot `Ic/*`. */
export type DeimosIconName =
  | "document"
  | "flower"
  | "heart"
  | "fork"
  | "chat"
  | "comment"
  | "globe"
  | "activity"
  | "sparkles"
  | "users"
  | "check"
  | "chevron-right"
  // Ardot Ic 新增（按钮 / 导航）
  | "send"
  | "plus"
  | "bell"
  | "gear"
  | "chevron"
  | "back"
  | "search"
  | "home"
  | "profile"
  // 补充图标（ardot 风格线框，对齐全站）
  | "share"
  | "bookmark"
  | "shield"
  | "lock"
  | "key"
  | "leaf";

type DeimosIconProps = {
  name: DeimosIconName;
  className?: string;
  style?: CSSProperties;
};

/**
 * Renders exported Deimos vector icons (`frontend/public/icons/deimos/*.svg`)
 * tinted via `currentColor`, matching iOS `DeimosIconView` template rendering.
 */
export function DeimosIcon({ name, className = "h-4 w-4", style }: DeimosIconProps) {
  const url = `/icons/deimos/${name}.svg`;

  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: "currentColor",
        maskImage: `url(${url})`,
        WebkitMaskImage: `url(${url})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        ...style,
      }}
    />
  );
}

/** Map agent activity action → Deimos icon. */
export function activityDeimosIcon(action: string): DeimosIconName {
  switch (action) {
    case "flower":
    case "flowers":
      return "flower";
    case "fork":
      return "fork";
    case "comment":
      return "comment";
    case "like":
      return "heart";
    case "register":
    case "create":
      return "document";
    default:
      return "sparkles";
  }
}
