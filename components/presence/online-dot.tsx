"use client";

import {useIsOnline} from "./presence-provider";
import {cn} from "@/lib/utils/cn";

export function OnlineDot({
  userId,
  className,
}: {
  userId: string | null | undefined;
  className?: string;
}) {
  const isOnline = useIsOnline(userId);

  if (!isOnline) return null;

  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 h-[10px] w-[10px] rounded-full border-2 border-white bg-green-500 shadow-sm",
        "animate-in fade-in zoom-in duration-200",
        className,
      )}
      aria-label="Online"
    />
  );
}
