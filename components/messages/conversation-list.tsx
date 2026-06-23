"use client";

import { useEffect, useState } from "react";
import { Archive, Inbox, MessageSquare, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { UserAvatar } from "@/components/layout/user-avatar";
import { Link, usePathname } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { ConversationListItem } from "@/lib/data/conversations";

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

function timeAgo(dateStr: string, locale: string, nowLabel: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return nowLabel;
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar" : "en", {
    day: "numeric",
    month: "short",
  });
}

function typeBadge(type: string, t: TranslationFn): string {
  return type === "graatek" ? t("groupChat.gar3tak") : t("idea");
}

function statusLabel(status: string | null | undefined, t: TranslationFn): string {
  const key = status && ["published", "interested", "discussion", "in_progress", "completed", "archived"].includes(status)
    ? `groupChat.statuses.${status}`
    : "groupChat.active";
  return t(key);
}

interface ConversationListProps {
  initialConversations: ConversationListItem[];
  currentUserId: string;
}

export function ConversationList({ initialConversations, currentUserId }: ConversationListProps) {
  const t = useTranslations("Messages");
  const locale = useLocale();
  const pathname = usePathname();
  const [conversations, setConversations] = useState(initialConversations);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterArchived, setFilterArchived] = useState(false);

  const filtered = conversations.filter((conversation) => {
    if (!filterArchived && conversation.archived_at) return false;
    if (filterArchived && !conversation.archived_at) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const otherName = (
      conversation.other_participant?.full_name ??
      conversation.other_participant?.username ??
      ""
    ).toLowerCase();
    return (
      otherName.includes(q) ||
      conversation.title.toLowerCase().includes(q) ||
      (conversation.idea_title ?? "").toLowerCase().includes(q)
    );
  });

  const activeConvId = pathname?.startsWith("/messages/")
    ? pathname.split("/messages/")[1]?.split("/")[0]
    : null;

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      try {
        const { getMyConversationsAction } = await import("@/app/[locale]/server-actions");
        const res = await getMyConversationsAction();
        if (res.success && res.conversations) {
          setConversations(res.conversations);
        }
      } catch (e) {
        console.error("realtime refresh error:", e);
      }
    }

    const channel = supabase
      .channel("inbox-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages" }, refresh)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${currentUserId}`,
        },
        refresh,
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-[56px] items-center justify-between border-b border-border/70 px-3">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          <Inbox size={18} />
          {t("title")}
        </h2>
        <button
          onClick={() => setFilterArchived((v) => !v)}
          className={cn(
            "rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted",
            filterArchived && "bg-muted text-foreground",
          )}
          title={filterArchived ? t("showActive") : t("showArchived")}
        >
          <Archive size={16} />
        </button>
      </div>

      <div className="border-b border-border/70 px-3 py-2">
        <div className="relative">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search")}
            style={{ paddingInlineStart: "2rem", paddingInlineEnd: "0.625rem" }}
            className="min-h-10 w-full rounded-full border border-border/60 bg-muted/50 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare size={36} className="mb-3 opacity-30" />
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          <ul>
            {filtered.map((conversation) => {
              const isActive = activeConvId === conversation.id;
              const isIdeaGroup = conversation.type === "idea";
              const name = isIdeaGroup
                ? conversation.title || conversation.idea_title || t("idea")
                : (conversation.other_participant?.full_name ??
                    conversation.other_participant?.username ??
                    conversation.title) ||
                  t("unknown");
              const avatarUrl = isIdeaGroup
                ? conversation.image_url
                : conversation.other_participant?.avatar_url ?? null;
              const lastMessage = conversation.last_message?.message_type === "image"
                ? conversation.last_message.message
                  ? t("groupChat.imageWithCaption", { caption: conversation.last_message.message })
                  : t("groupChat.image")
                : conversation.last_message?.message ?? "";
              const lastTime = conversation.last_message?.created_at ?? conversation.created_at;
              const badge = typeBadge(conversation.type, t);
              const secondary = isIdeaGroup
                ? t("groupChat.memberCount", { count: conversation.member_count || 1 })
                : conversation.title;

              return (
                <li key={conversation.id}>
                  <Link
                    href={`/messages/${conversation.id}`}
                    className={cn(
                      "flex min-h-[72px] items-center gap-3 border-s-4 px-3 py-2.5 transition hover:bg-muted/45",
                      isActive ? "border-primary bg-primary/[0.07]" : "border-transparent",
                    )}
                  >
                    <UserAvatar label={name} avatarUrl={avatarUrl} className="h-11 w-11 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold leading-tight text-foreground">{name}</p>
                          <span className="inline-flex shrink-0 rounded-[4px] bg-muted px-1.5 py-[2px] text-[10px] font-medium leading-none text-muted-foreground">
                            {badge}
                          </span>
                        </div>
                        {lastTime && (
                          <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                            {timeAgo(lastTime, locale, t("groupChat.now"))}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                          {lastMessage || t("noMessagesYet")}
                        </p>
                        {conversation.unread_count > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                            {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">
                        {isIdeaGroup && conversation.idea_status ? statusLabel(conversation.idea_status, t) : secondary}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
