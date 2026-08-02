import Link from "next/link";
import { IconLeaf } from "@/components/icons";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
      <h1 className="heading-serif text-2xl mb-2">{t("common.pageNotFound")}</h1>
      <p className="text-[var(--text-muted)] mb-6">
        {t("common.pageNotFoundHint")}
      </p>
      <Link
        href="/"
        className="btn-outline px-6 py-2.5 text-sm font-medium"
      >
        {t("common.backHome")}
      </Link>
    </div>
  );
}
