"use client";

import {useState, useTransition} from "react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

import {toggleFollowAction} from "@/app/[locale]/server-actions";
import {Button} from "@/components/ui/button";
import {useRouter} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";

export function FollowSummary({
  profileId,
  username,
  locale,
  currentUserId,
  initialIsFollowing,
  initialFollowersCount,
  followingCount,
  showButton = true,
}: {
  profileId: string;
  username: string | null;
  locale: string;
  currentUserId?: string | null;
  initialIsFollowing: boolean;
  initialFollowersCount: number;
  followingCount: number;
  showButton?: boolean;
}) {
  const t = useTranslations("Follow");
  const toasts = useTranslations("Toasts");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const canShowButton = showButton && currentUserId !== profileId;

  function handleCountClick() {
    toast.info(toasts("comingSoon"));
  }

  function handleFollowClick() {
    const publicProfilePath = withLocale(`/profile/${username ?? profileId}`, locale);

    if (!currentUserId) {
      toast.info(t("loginToFollow"));
      router.push(`${withLocale("/register", locale)}?next=${encodeURIComponent(publicProfilePath)}`);
      return;
    }

    const previousIsFollowing = isFollowing;
    const previousFollowersCount = followersCount;
    const nextIsFollowing = !previousIsFollowing;

    setIsFollowing(nextIsFollowing);
    setFollowersCount((count) => Math.max(0, count + (nextIsFollowing ? 1 : -1)));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("profileId", profileId);
      if (username) formData.set("profileUsername", username);

      const result = await toggleFollowAction(formData);
      if (!result.success || result.following == null) {
        setIsFollowing(previousIsFollowing);
        setFollowersCount(previousFollowersCount);
        toast.error(t("failed"));
        return;
      }

      setIsFollowing(result.following);
      setFollowersCount(Math.max(0, previousFollowersCount + (result.following ? 1 : -1)));
      toast.success(result.following ? t("followedToast") : t("unfollowedToast"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      {canShowButton ? (
        <Button
          type="button"
          variant={isFollowing ? "outline" : "default"}
          onClick={handleFollowClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          disabled={isPending}
          className="rounded-full px-5"
        >
          {isFollowing ? (isHovering ? t("unfollow") : t("following")) : t("follow")}
        </Button>
      ) : null}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground sm:justify-start">
        <button type="button" onClick={handleCountClick} className="hover:text-foreground">
          <span className="font-semibold text-foreground">{followersCount}</span> {t("followers")}
        </button>
        <button type="button" onClick={handleCountClick} className="hover:text-foreground">
          <span className="font-semibold text-foreground">{followingCount}</span> {t("followingCount")}
        </button>
      </div>
    </div>
  );
}
