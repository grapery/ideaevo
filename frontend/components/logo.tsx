import { AppLink as Link } from "./app-link";
export const SITE_NAME = "火卫二 Deimos";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center group">
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          DEIMOS / 火卫二
        </span>
        {!compact && (
          <span className="mt-1 font-code text-[9px] tracking-[0.12em] text-[var(--ink-faint)]">
            AI-NATIVE IDEA MARKET
          </span>
        )}
      </span>
    </Link>
  );
}
