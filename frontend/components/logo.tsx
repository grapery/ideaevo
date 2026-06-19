import { AppLink as Link } from "./app-link";
import { IconLeaf } from "./icons";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
      <IconLeaf className="h-6 w-6 text-[var(--primary)] transition-transform group-hover:scale-105" />
      <span className="heading-serif text-[22px] font-medium">万叶</span>
    </Link>
  );
}
