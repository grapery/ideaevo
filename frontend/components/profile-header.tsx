import type { ReactNode } from "react";
import Link from "next/link";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import type { EntityKind } from "@/lib/avatar";

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
  avatarEntityId?: string;
  avatarKind?: EntityKind;
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
  avatarEntityId,
  avatarKind = "user",
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
  const isAgent = Boolean(badge);

  return (
    <section
      className={`relative overflow-hidden rounded-[var(--radius-card)] border p-5 ${
        isAgent
          ? "border-[var(--rule-strong)] bg-[var(--panel-inverse)] text-white"
          : "border-[var(--callout-primary-border)] bg-[var(--bg-surface)] text-[var(--ink)]"
      }`}
    >
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.08]" />
      )}
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {isAgent && avatarEntityId ? (
            <WireframeAvatar
              name={name}
              avatarUrl={avatarUrl}
              entityId={avatarEntityId}
              kind={avatarKind}
              size={64}
            />
          ) : avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className={`h-16 w-16 shrink-0 object-cover ${
                isAgent
                  ? "rounded-[var(--radius-btn)] border border-white/20"
                  : "rounded-full border border-[var(--callout-primary-border)]"
              }`}
            />
          ) : (
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center font-display text-[18px] font-bold ${
                isAgent
                  ? "rounded-[var(--radius-btn)] border border-white/20 bg-[var(--accent-link)] text-white"
                  : "rounded-full border border-[var(--callout-primary-border)] bg-[var(--callout-primary-bg)] text-[var(--primary)]"
              }`}
            >
              {initial}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className={`page-heading text-[1.5rem] ${isAgent ? "text-white" : ""}`}>
                {name}
              </h1>
              {badge}
              {isAgent && <span className="font-code text-[10px] panel-inverse-accent">● OPERATIONAL</span>}
            </div>
            {handle && (
              <p className={`mt-1 font-code text-[10px] ${isAgent ? "text-white/50" : "text-[var(--ink-faint)]"}`}>
                {handle}
              </p>
            )}
            {description && (
              <p className={`mt-2 max-w-2xl text-[13px] leading-5 ${isAgent ? "text-white/70" : "text-[var(--ink-soft)]"}`}>
                {description}
              </p>
            )}
            {owner && (
              <Link
                href={`/users/${owner.id}`}
                className={`mt-2 inline-flex items-center gap-2 font-code text-[9px] ${
                  isAgent ? "text-[#8dc0ff]" : "text-[var(--accent-link)]"
                }`}
              >
                OWNER / {owner.name} →
              </Link>
            )}
            {metaPills && metaPills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4">
                {metaPills.map((pill) => (
                  <span
                    key={pill}
                    className={`font-code text-[9px] ${isAgent ? "text-[#858993]" : "text-[var(--ink-faint)]"}`}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            )}
            {tags && tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {tags.map((tag) => (
                  <span key={tag} className={`font-code text-[10px] ${isAgent ? "text-[var(--accent-link)]" : "text-[var(--primary)]"}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          {permissions && (
            <p className={`font-code text-[9px] ${isAgent ? "text-[#858993]" : "text-[var(--ink-faint)]"}`}>
              FOLLOW {permissions.allowFollow === false ? "OFF" : "ON"} · CHAT {permissions.allowChat === false ? "OFF" : "ON"}
            </p>
          )}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className={`relative mt-5 flex flex-wrap gap-x-7 gap-y-2 border-t pt-4 ${
          isAgent ? "border-[#2d2d32]" : "border-[var(--rule)]"
        }`}>
          {stats.map((stat, index) => {
            const content = (
              <>
                {stat.icon}
                <span className={`font-display text-[14px] font-bold ${isAgent ? "text-white" : "text-[var(--ink)]"}`}>
                  {stat.value}
                </span>
                <span className={`font-code text-[9px] ${isAgent ? "text-[#858993]" : "text-[var(--ink-faint)]"}`}>
                  {stat.label}
                </span>
              </>
            );
            return stat.onClick ? (
              <button key={index} type="button" onClick={stat.onClick} className="inline-flex items-center gap-1.5 hover:opacity-80">
                {content}
              </button>
            ) : (
              <span key={index} className="inline-flex items-center gap-1.5">{content}</span>
            );
          })}
        </div>
      )}
    </section>
  );
}
