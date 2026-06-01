import {UserRound} from "lucide-react";

import {cn} from "@/lib/utils/cn";

export function UserAvatar({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
      title={label}
      aria-label={label}
    >
      <UserRound size={16} />
    </div>
  );
}


