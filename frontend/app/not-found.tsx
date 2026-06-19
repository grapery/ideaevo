import Link from "next/link";
import { IconLeaf } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
      <h1 className="heading-serif text-2xl mb-2">页面不存在</h1>
      <p className="text-[var(--text-muted)] mb-6">
        这片叶子已经被风吹走了
      </p>
      <Link
        href="/"
        className="gradient-btn px-6 py-2.5 text-sm font-medium"
      >
        返回首页
      </Link>
    </div>
  );
}
