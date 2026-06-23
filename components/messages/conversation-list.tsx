"use client";

import { useState, useEffect } from "react";
import { Inbox, Search, MessageSquare, Archive } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/routing";
import { UserAvatar } from "@/components/layout/user-avatar";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import type { ConversationListItem } from "@/lib/data/conversations";

function timeAgo(dateStr: string, locale: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return locale === "ar" ? "الآن" : "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar" : "en", { day: "numeric", month: "short" });
}

function typeBadge(type: string, t: (key: string) => string): { emoji: string; label: string } {
  if (type === "graatek") return { emoji: "🎁", label: "Gar3tak" };
  return { emoji: "💡", label: t("idea") };
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

  const filtered = conversations.filter((c) => {
    if (!filterArchived && c.archived_at) return false;
    if (filterArchived && !c.archived_at) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.other_participant?.full_name ?? c.other_participant?.username ?? "").toLowerCase();
    return name.includes(q) || c.title.toLowerCase().includes(q);
  });

  const activeConvId = pathname?.startsWith("/messages/") ? pathname.split("/messages/")[1]?.split("/")[0] : null;

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("inbox-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        async () => {
           try {
             const { getMyConversationsAction } = await import("@/app/[locale]/server-actions");
             const res = await getMyConversationsAction();
             if (res.success && res.conversations) {
               setConversations(res.conversations);
             }
           } catch (e) {
             console.error("realtime refresh error:", e);
           }
         },
       )
       .on(
         "postgres_changes",
         { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `user_id=eq.${currentUserId}` },
         async () => {
           try {
             const { getMyConversationsAction } = await import("@/app/[locale]/server-actions");
             const res = await getMyConversationsAction();
             if (res.success && res.conversations) {
               setConversations(res.conversations);
             }
           } catch (e) {
             console.error("realtime refresh error:", e);
           }
         },
       )
       .on(
         "postgres_changes",
         { event: "UPDATE", schema: "public", table: "conversations" },
         async () => {
           try {
             const { getMyConversationsAction } = await import("@/app/[locale]/server-actions");
             const res = await getMyConversationsAction();
             if (res.success && res.conversations) {
               setConversations(res.conversations);
             }
           } catch (e) {
             console.error("realtime refresh error:", e);
           }
         },
       )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <Inbox size={18} />
          {t("title")}
        </h2>
        <button
          onClick={() => setFilterArchived((v) => !v)}
          className={cn(
            "rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition",
            filterArchived && "bg-muted text-foreground",
          )}
          title={filterArchived ? t("showActive") : t("showArchived")}
        >
          <Archive size={16} />
        </button>
      </div>

      <div className="border-b border-border/70 px-2 py-1.5">
        <div className="relative">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search")}
            style={{ paddingInlineStart: "2rem", paddingInlineEnd: "0.625rem" }}
            className="w-full rounded-lg border border-border/60 bg-muted/50 py-1.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
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
            {filtered.map((conv) => {
              const isActive = activeConvId === conv.id;
              const name = conv.other_participant?.full_name ?? conv.other_participant?.username ?? (conv.title || t("unknown"));
              const avatarUrl = conv.other_participant?.avatar_url ?? null;
              const lastMsg = conv.last_message?.message ?? "";
              const lastTime = conv.last_message?.created_at ?? conv.created_at;
              const badge = typeBadge(conv.type, t);

              return (
                <li key={conv.id}>
                  <Link
                    href={`/messages/${conv.id}`}
                    className={cn(
                      "flex items-start gap-2.5 border-s-2 px-3 py-2.5 transition hover:bg-muted/50",
                      isActive ? "border-primary bg-primary/[0.04]" : "border-transparent",
                    )}
                  >
                    <UserAvatar label={name} avatarUrl={avatarUrl} className="mt-0.5 h-9 w-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-[4px] bg-muted px-1.5 py-[2px] text-[10px] leading-none text-muted-foreground">
                          <span>{badge.emoji}</span>
                          <span>{badge.label}</span>
                        </span>
                        {lastTime && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {timeAgo(lastTime, locale)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {lastMsg || t("noMessagesYet")}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                            {conv.unread_count > 99 ? "99+" : conv.unread_count}
                          </span>
                        )}
                      </div>
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
