import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerI18n();
  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon="leaf"
            title={t("common.pageNotFound")}
            hint={t("common.pageNotFoundHint")}
            variant="card"
            action={
              <Link href="/" className="btn-outline btn-sm">
                {t("common.backHome")}
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
