import type { ReactNode } from "react";

/**
 * ProfileHeader —— 统一的主页头部（Agent / 用户主页 / 他人主页共用）。
 * 借鉴 GitHub profile：全宽 banner（无边框/圆角）+ 圆形头像上浮 +
 * 名称/handle/简介 + inline 统计 + 右上角操作区。
 */

export type ProfileStat = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
};

export interface ProfileHeaderProps {
  name: string;
  /** handle / 副标题（如 @agent_id、邮箱）。 */
  handle?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  description?: string;
  tags?: string[];
  stats?: ProfileStat[];
  /** 右上角操作区（对话、关注、编辑资料等）。 */
  actions?: ReactNode;
}

export function ProfileHeader({
  name,
  handle,
  avatarUrl,
  bannerUrl,
  description,
  tags,
  stats,
  actions,
}: ProfileHeaderProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="surface-card overflow-hidden">
      {/* Banner — 全宽、无边框、无圆角，仅底部 border */}
      <div className="relative h-32 sm:h-36 bg-[var(--primary-soft)]">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--primary-soft)] via-[var(--bg-subtle)] to-[var(--teal)]/20" />
        )}
      </div>

      {/* Identity row */}
      <div className="relative px-5 sm:px-6 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Avatar — 圆形，上浮覆盖 banner */}
          <div className="-mt-10 shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-24 w-24 rounded-full border-4 border-[var(--bg-surface)] object-cover shadow-[var(--shadow)]"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[var(--bg-surface)] bg-[var(--primary-soft)] text-3xl font-semibold text-[var(--primary)] shadow-[var(--shadow)]">
                {initial}
              </div>
            )}
          </div>

          {/* Name + meta + stats */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="heading-serif text-2xl leading-tight">{name}</h1>
                {handle && (
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">{handle}</p>
                )}
              </div>
              {actions && (
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
              )}
            </div>

            {description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl">
                {description}
              </p>
            )}

            {tags && tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="tag-pill">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {stats && stats.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--text-secondary)]">
                {stats.map((s, i) =>
                  s.onClick ? (
                    <button
                      key={i}
                      type="button"
                      onClick={s.onClick}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors"
                    >
                      {s.icon}
                      <span className="font-semibold text-[var(--title)] hover:text-[var(--primary)]">{s.value}</span>
                      <span className="text-[var(--text-muted)] hover:text-[var(--primary)]">{s.label}</span>
                    </button>
                  ) : (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      {s.icon}
                      <span className="font-semibold text-[var(--title)]">{s.value}</span>
                      <span className="text-[var(--text-muted)]">{s.label}</span>
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
