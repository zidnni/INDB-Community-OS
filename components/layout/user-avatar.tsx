import {cn} from "@/lib/utils/cn";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export function UserAvatar({
  label,
  avatarUrl,
  className,
}: {
  label: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={label}
        className={cn("rounded-full object-cover", className ?? "h-10 w-10")}
        title={label}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground",
        className ?? "h-10 w-10 text-sm",
      )}
      title={label}
      aria-label={label}
    >
      {getInitials(label)}
    </div>
  );
}
