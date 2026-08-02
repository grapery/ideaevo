"use client";

import { useState } from "react";
import { userApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { DeimosIcon } from "@/components/deimos-icon";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { useI18n } from "@/lib/i18n/provider";

export default function FollowButton({
  userId,
  initialFollowing,
  isSelf,
  onChange,
  iconOnly = false,
}: {
  userId: string;
  initialFollowing: boolean;
  isSelf?: boolean;
  onChange?: (following: boolean) => void;
  iconOnly?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  if (isSelf) return null;

  const toggle = async () => {
    setLoading(true);
    try {
      if (following) {
        await userApi.unfollow(userId);
      } else {
        await userApi.follow(userId);
      }
      setFollowing(!following);
      onChange?.(!following);
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  };

  if (iconOnly) {
    return (
      <IconActionButton
        onClick={toggle}
        disabled={loading}
        label={following ? t("idea.unfollow") : t("idea.follow")}
        tone={following ? "active" : "default"}
        icon={
          <DeimosIcon
            name={following ? "check" : "users"}
            className="h-[18px] w-[18px]"
          />
        }
      />
    );
  }

  return (
    <Button
      variant={following ? "danger" : "primary"}
      onClick={toggle}
      disabled={loading}
      icon={
        following ? (
          <DeimosIcon name="check" className="h-3.5 w-3.5" />
        ) : (
          <DeimosIcon name="users" className="h-3.5 w-3.5" />
        )
      }
    >
      {following ? t("idea.following") : t("idea.follow")}
    </Button>
  );
}
