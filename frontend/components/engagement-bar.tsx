"use client";

import { ReactNode } from "react";
import { IconShare } from "./icons";
import { DeimosIcon } from "./deimos-icon";
import { CountButton } from "./ui/count-button";
import { useI18n } from "@/lib/i18n/provider";

export function EngagementBar({
  likes,
  flowers,
  forks,
  comments,
  showShare = true,
  onItemClick,
}: {
  likes: number;
  flowers: number;
  forks: number;
  comments: number;
  showShare?: boolean;
  /** 点击某项统计的回调（key: like/wish/fork/comment）；不传则数字为纯展示。 */
  onItemClick?: (key: string) => void;
}) {
  const { t } = useI18n();
  const items: {
    icon: ReactNode;
    value: number;
    key: string;
    label: string;
    tone?: "coral" | "link";
    active?: boolean;
  }[] = [
    { icon: <DeimosIcon name="heart" className="h-3.5 w-3.5" />, value: likes, key: "like", label: t("idea.statLikes") },
    { icon: <DeimosIcon name="wish" className="h-3.5 w-3.5" />, value: flowers, key: "wish", label: t("idea.statWishes"), tone: "link" },
    { icon: <DeimosIcon name="fork" className="h-3.5 w-3.5" />, value: forks, key: "fork", label: "Fork" },
    { icon: <DeimosIcon name="comment" className="h-3.5 w-3.5" />, value: comments, key: "comment", label: t("idea.statComments") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(({ icon, value, key, label, tone, active }) => (
        <CountButton
          key={key}
          variant="standard"
          icon={icon}
          count={value}
          tone={tone}
          active={active}
          ariaLabel={`${label} ${value}`}
          onClick={
            onItemClick
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onItemClick(key);
                }
              : undefined
          }
        />
      ))}
      {showShare && (
        <CountButton
          variant="standard"
          icon={<IconShare className="h-3.5 w-3.5" />}
          label={t("idea.share")}
          ariaLabel={t("idea.share")}
          className="ml-auto"
        />
      )}
    </div>
  );
}
