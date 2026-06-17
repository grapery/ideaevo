import { IconFlower, IconGitFork, IconHeart, IconMessage, IconShare } from "./icons";

export function EngagementBar({
  likes,
  flowers,
  forks,
  comments,
  showShare = true,
}: {
  likes: number;
  flowers: number;
  forks: number;
  comments: number;
  showShare?: boolean;
}) {
  const items = [
    { icon: IconHeart, value: likes, label: "点赞", className: "" },
    { icon: IconFlower, value: flowers, label: "鲜花", className: "text-[var(--coral)]" },
    { icon: IconGitFork, value: forks, label: "Fork", className: "" },
    { icon: IconMessage, value: comments, label: "评论", className: "" },
  ];

  return (
    <div className="flex items-center gap-7 text-[var(--text-secondary)]">
      {items.map(({ icon: Icon, value, label, className }) => (
        <span key={label} className={`inline-flex items-center gap-1 text-[13px] tabular-nums ${className}`}>
          <Icon />
          <span>{value}</span>
        </span>
      ))}
      {showShare && (
        <button type="button" aria-label="分享" className="inline-flex items-center gap-1 text-[13px] hover:text-[var(--primary)] ml-auto">
          <IconShare />
          <span>分享</span>
        </button>
      )}
    </div>
  );
}
