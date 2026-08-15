"use client";

import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/lib/i18n/provider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon="evidence"
            title={t("common.somethingWrong")}
            hint={error.message || t("common.loadFailed")}
            variant="card"
            action={
              <button onClick={reset} className="btn-outline btn-sm">
                {t("common.retry")}
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}
