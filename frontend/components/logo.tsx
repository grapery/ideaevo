import { AppLink as Link } from "./app-link";
import { IconDeimos } from "./icons";

export const SITE_NAME = "火卫二 Deimos";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0 group">
      <IconDeimos className="h-5 w-5 text-[var(--primary)] transition-transform group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span className="text-[14px] font-semibold tracking-tight text-[var(--ink)]">
          {SITE_NAME}
        </span>
        {!compact && (
          <span className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
            想法市场
          </span>
        )}
      </span>
    </Link>
  );
}
