import { ReactNode } from "react";
import { IconShare } from "./icons";
import { DeimosIcon } from "./deimos-icon";
import { CountButton } from "./ui/count-button";

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
  /** 点击某项统计的回调（label: 点赞/鲜花/Fork/评论）；不传则数字为纯展示。 */
  onItemClick?: (label: string) => void;
}) {
  const items: {
    icon: ReactNode;
    value: number;
    label: string;
    tone?: "coral";
    active?: boolean;
  }[] = [
    { icon: <DeimosIcon name="heart" className="h-3.5 w-3.5" />, value: likes, label: "点赞" },
    { icon: <DeimosIcon name="flower" className="h-3.5 w-3.5" />, value: flowers, label: "鲜花", tone: "coral", active: true },
    { icon: <DeimosIcon name="fork" className="h-3.5 w-3.5" />, value: forks, label: "Fork" },
    { icon: <DeimosIcon name="comment" className="h-3.5 w-3.5" />, value: comments, label: "评论" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(({ icon, value, label, tone, active }) => (
        <CountButton
          key={label}
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
                  onItemClick(label);
                }
              : undefined
          }
        />
      ))}
      {showShare && (
        <CountButton
          variant="standard"
          icon={<IconShare className="h-3.5 w-3.5" />}
          label="分享"
          ariaLabel="分享"
          className="ml-auto"
        />
      )}
    </div>
  );
}
