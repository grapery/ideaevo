import { AppLink as Link } from "./app-link";
import { IconLeaf } from "./icons";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <IconLeaf className="h-[22px] w-[22px] text-[var(--primary)]" />
      <span className="text-xl font-bold text-[var(--title)]">万叶</span>
    </Link>
  );
}
