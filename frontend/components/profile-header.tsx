import type { ReactNode } from "react";
import Link from "next/link";
import { DeimosIcon } from "@/components/deimos-icon";

/**
 * ProfileHeader —— 统一的主页头部（Agent / 用户主页 / 他人主页共用）。
 * 扁平 float 风格：全宽 banner + 上浮身份卡片 + 圆形头像叠层。
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
  /** 身份区角标（如 Agent、关注者数）。 */
  badge?: ReactNode;
  /** Meta pills：公开 / 模型 / 注册时间 */
  metaPills?: string[];
  /** 创建者行 */
  owner?: { id: string; name: string; avatar_url?: string };
  /** 权限提示 */
  permissions?: { allowFollow?: boolean; allowChat?: boolean };
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
  badge,
  metaPills,
  owner,
  permissions,
}: ProfileHeaderProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative">
      {/* Banner — 全宽扁平渐变，无卡片边框 */}
      <div className="relative h-36 sm:h-40 overflow-hidden rounded-t-[var(--radius-float)]">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--primary-soft)] via-[var(--bg-subtle)] to-[var(--teal-soft)]" />
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)]/30 to-transparent"
          aria-hidden
        />
      </div>

      {/* Float identity card */}
      <div className="profile-float-card relative z-10 mx-3 sm:mx-4 -mt-14 px-5 sm:px-6 pb-5 pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4 min-w-0 flex-1">
            {/* Avatar — 圆形上浮，叠在 banner 与卡片交界处 */}
            <div className="-mt-12 sm:-mt-14 shrink-0 self-start">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-4 border-[var(--bg-surface)] object-cover shadow-[var(--shadow-float)]"
                />
              ) : (
                <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-4 border-[var(--bg-surface)] bg-[var(--primary-soft)] text-2xl sm:text-3xl font-semibold text-[var(--primary)] shadow-[var(--shadow-float)]">
                  {initial}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 pt-1 sm:pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="heading-serif text-xl sm:text-2xl leading-tight">{name}</h1>
                {badge}
              </div>
              {metaPills && metaPills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {metaPills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              )}
              {owner && (
                <Link
                  href={`/users/${owner.id}`}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                >
                  {owner.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={owner.avatar_url}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[10px] font-semibold text-[var(--primary)]">
                      {owner.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>由 {owner.name} 创建</span>
                  <span aria-hidden className="text-[var(--text-muted)]">›</span>
                </Link>
              )}
              {permissions && (permissions.allowFollow !== false || permissions.allowChat !== false) && (
                <p className="mt-2 text-xs text-[var(--text-muted)] flex flex-wrap gap-x-4 gap-y-1">
                  {permissions.allowFollow !== false && (
                    <span className="inline-flex items-center gap-1.5">
                      <DeimosIcon name="users" className="h-3.5 w-3.5" />
                      允许关注
                    </span>
                  )}
                  {permissions.allowChat !== false && (
                    <span className="inline-flex items-center gap-1.5">
                      <DeimosIcon name="chat" className="h-3.5 w-3.5" />
                      允许对话
                    </span>
                  )}
                </p>
              )}
              {handle && (
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{handle}</p>
              )}
              {description && (
                <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                  {description}
                </p>
              )}
              {tags && tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--primary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex shrink-0 items-center gap-2 sm:pt-2">{actions}</div>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-[var(--bg-subtle)]/80 px-4 py-3 text-sm text-[var(--text-secondary)]">
            {stats.map((s, i) =>
              s.onClick ? (
                <button
                  key={i}
                  type="button"
                  onClick={s.onClick}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors"
                >
                  {s.icon}
                  <span className="font-semibold text-[var(--title)] tabular-nums">{s.value}</span>
                  <span className="text-[var(--text-muted)]">{s.label}</span>
                </button>
              ) : (
                <span key={i} className="inline-flex items-center gap-1.5">
                  {s.icon}
                  <span className="font-semibold text-[var(--title)] tabular-nums">{s.value}</span>
                  <span className="text-[var(--text-muted)]">{s.label}</span>
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
