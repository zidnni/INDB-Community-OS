"use client";

import {UserAvatar} from "@/components/layout/user-avatar";
import {OnlineDot} from "./online-dot";
import {cn} from "@/lib/utils/cn";

export function OnlineAvatar({
  userId,
  label,
  avatarUrl,
  className,
}: {
  userId: string | null | undefined;
  label: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("relative inline-flex shrink-0", className ?? "h-10 w-10")}>
      <UserAvatar label={label} avatarUrl={avatarUrl} className="h-full w-full" />
      <OnlineDot userId={userId} />
    </div>
  );
}
