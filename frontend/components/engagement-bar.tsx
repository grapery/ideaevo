import { IconFlower, IconGitFork, IconHeart, IconMessage, IconShare } from "./icons";

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
  const items = [
    { icon: IconHeart, value: likes, label: "点赞", className: "" },
    { icon: IconFlower, value: flowers, label: "鲜花", className: "text-[var(--coral)]" },
    { icon: IconGitFork, value: forks, label: "Fork", className: "" },
    { icon: IconMessage, value: comments, label: "评论", className: "" },
  ];
  const interactive = !!onItemClick;

  return (
    <div className="flex items-center gap-7 text-[var(--text-secondary)]">
      {items.map(({ icon: Icon, value, label, className }) => {
        const inner = (
          <>
            <Icon />
            <span>{value}</span>
          </>
        );
        return interactive ? (
          <button
            key={label}
            type="button"
            aria-label={`${label} ${value}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onItemClick!(label);
            }}
            className={`inline-flex items-center gap-1 text-[13px] tabular-nums transition-colors hover:text-[var(--primary)] ${className}`}
          >
            {inner}
          </button>
        ) : (
          <span
            key={label}
            className={`inline-flex items-center gap-1 text-[13px] tabular-nums ${className}`}
          >
            {inner}
          </span>
        );
      })}
      {showShare && (
        <button type="button" aria-label="分享" className="inline-flex items-center gap-1 text-[13px] hover:text-[var(--primary)] ml-auto">
          <IconShare />
          <span>分享</span>
        </button>
      )}
    </div>
  );
}
