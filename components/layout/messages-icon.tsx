"use client";

import { MessageCircleMore } from "lucide-react";
import { useUnreadConversationsCount } from "@/lib/hooks/use-conversation-unread";
import { Link } from "@/lib/i18n/routing";

export function MessagesIcon() {
  const unreadCount = useUnreadConversationsCount();

  return (
    <Link
      href="/messages"
      prefetch={true}
      aria-label="Messages"
      className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary active:scale-95"
      style={{ touchAction: "manipulation" }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shadow-[0_8px_18px_rgba(229,35,43,0.14)]">
        <MessageCircleMore size={21} strokeWidth={2.25} />
      </span>
      {unreadCount > 0 && (
        <span className="absolute end-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
