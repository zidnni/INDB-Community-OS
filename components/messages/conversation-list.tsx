"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Ban, Gift, Inbox, Lightbulb, MessageSquare, Search, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { OnlineAvatar } from "@/components/presence";
import { Link, usePathname } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { ConversationListItem } from "@/lib/data/conversations";

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;
type InboxCategory = "people" | "graatek" | "ideas";

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
  if (type === "graatek") return t("groupChat.gar3tak");
  if (type === "direct") return t("groupChat.directChat");
  return t("idea");
}

function statusLabel(status: string | null | undefined, t: TranslationFn): string {
  const key = status && ["published", "interested", "discussion", "in_progress", "completed", "archived"].includes(status)
    ? `groupChat.statuses.${status}`
    : "groupChat.active";
  return t(key);
}

function conversationCategory(conversation: ConversationListItem): InboxCategory | null {
  if (conversation.type === "graatek") return "graatek";
  if (conversation.type === "idea") return "ideas";
  if (conversation.type === "direct" && conversation.is_mutual_follow) return "people";
  return null;
}

interface ConversationListProps {
  initialConversations: ConversationListItem[];
  currentUserId: string;
}

export function ConversationList({ initialConversations, currentUserId }: ConversationListProps) {
  const t = useTranslations("Messages");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState(initialConversations);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterArchived, setFilterArchived] = useState(false);
  const [activeCategory, setActiveCategory] = useState<InboxCategory>("people");
  const activeConvId = pathname?.match(/\/messages\/([^/?#]+)/)?.[1] ?? searchParams.get("conversation");
  const activeConvIdRef = useRef(activeConvId);

  const visibleByArchive = useMemo(() => {
    return conversations.filter((conversation) => {
      if (!filterArchived && conversation.archived_at) return false;
      if (filterArchived && !conversation.archived_at) return false;
      return true;
    });
  }, [conversations, filterArchived]);

  const categoryStats = useMemo(() => {
    const stats: Record<InboxCategory, { count: number; unread: number }> = {
      people: { count: 0, unread: 0 },
      graatek: { count: 0, unread: 0 },
      ideas: { count: 0, unread: 0 },
    };

    visibleByArchive.forEach((conversation) => {
      const category = conversationCategory(conversation);
      if (!category) return;
      stats[category].count += 1;
      stats[category].unread += conversation.unread_count;
    });

    return stats;
  }, [visibleByArchive]);

  const filtered = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();

    return visibleByArchive.filter((conversation) => {
      if (conversationCategory(conversation) !== activeCategory) return false;
      if (!q) return true;

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
  }, [activeCategory, deferredSearchQuery, visibleByArchive]);

  const categories = useMemo(
    () => [
      { key: "people" as const, label: t("categories.people"), icon: Users, ...categoryStats.people },
      { key: "graatek" as const, label: t("categories.graatek"), icon: Gift, ...categoryStats.graatek },
      { key: "ideas" as const, label: t("categories.ideas"), icon: Lightbulb, ...categoryStats.ideas },
    ],
    [categoryStats, t],
  );

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
    if (!activeConvId) return;
    const activeConversation = conversations.find((conversation) => conversation.id === activeConvId);
    const activeConversationCategory = activeConversation ? conversationCategory(activeConversation) : null;
    if (activeConversationCategory) setActiveCategory(activeConversationCategory);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConvId
          ? { ...conversation, unread_count: 0 }
          : conversation,
      ),
    );
  }, [activeConvId]);

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

    function applyInsertedMessage(payload: { new: Record<string, unknown> }) {
      const row = payload.new;
      const conversationId = typeof row.conversation_id === "string" ? row.conversation_id : null;
      if (!conversationId) return;

      setConversations((prev) => {
        const index = prev.findIndex((conversation) => conversation.id === conversationId);
        if (index === -1) return prev;
        const current = prev[index];
        const senderId = typeof row.sender_id === "string" ? row.sender_id : "";
        if (current.is_blocked_by_me && senderId === current.other_participant?.id) return prev;
        const updated: ConversationListItem = {
          ...current,
          last_message: {
            message: typeof row.message === "string" ? row.message : null,
            message_type: row.message_type === "image" ? "image" : "text",
            image_url: typeof row.image_url === "string" ? row.image_url : null,
            created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
            sender_id: senderId,
          },
          unread_count:
            senderId === currentUserId || conversationId === activeConvIdRef.current
              ? 0
              : current.unread_count + 1,
        };
        return [updated, ...prev.slice(0, index), ...prev.slice(index + 1)];
      });
    }

    const channel = supabase
      .channel("inbox-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages" }, applyInsertedMessage)
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
      <div className="flex min-h-[56px] items-center justify-between border-b border-border/70 bg-card/95 px-3 shadow-sm backdrop-blur md:bg-background md:shadow-none">
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

      <div className="border-b border-border/70 bg-background px-3 py-2">
        <div className="mb-2 grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1">
          {categories.map((category) => {
            const Icon = category.icon;
            const active = activeCategory === category.key;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                className={cn(
                  "relative flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground active:bg-card/60 md:hover:bg-card/50",
                )}
                aria-pressed={active}
              >
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{category.label}</span>
                {category.unread > 0 ? (
                  <span className="absolute -top-1 end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {category.unread > 99 ? "99+" : category.unread}
                  </span>
                ) : category.count > 0 ? (
                  <span className="hidden rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline-flex">
                    {category.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
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

      <div className="flex-1 overflow-y-auto scroll-smooth pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
            <MessageSquare size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium text-foreground">{t(`categoryEmpty.${activeCategory}`)}</p>
            <p className="mt-1 text-xs">{t("categoryEmptyHint")}</p>
          </div>
        ) : (
          <ul>
            {filtered.map((conversation) => {
              const isActive = activeConvId === conversation.id;
              const isIdeaGroup = conversation.type === "idea";
              const otherUserId = !isIdeaGroup ? conversation.other_participant?.id : undefined;
              const name = isIdeaGroup
                ? conversation.title || conversation.idea_title || t("idea")
                : (conversation.other_participant?.full_name ??
                    conversation.other_participant?.username ??
                    conversation.title) ||
                  t("unknown");
              const avatarUrl = isIdeaGroup
                ? conversation.image_url
                : conversation.other_participant?.avatar_url ?? null;
              const isBlocked = Boolean(conversation.is_blocked_by_me || conversation.is_blocked_by_other);
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
                    prefetch={true}
                    className={cn(
                      "flex min-h-[74px] items-center gap-3 border-s-4 px-3 py-2.5 transition active:bg-muted/60 md:min-h-[72px] md:hover:bg-muted/45",
                      isActive ? "border-primary bg-primary/[0.07]" : "border-transparent",
                    )}
                  >
                    {isBlocked && !isIdeaGroup ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground md:h-11 md:w-11">
                        <Ban size={18} />
                      </div>
                    ) : (
                      <OnlineAvatar userId={otherUserId} label={name} avatarUrl={avatarUrl} className="h-10 w-10 shrink-0 md:h-11 md:w-11" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-sm font-semibold leading-tight text-foreground">{name}</p>
                          <span className="inline-flex max-w-[5.5rem] shrink-0 truncate rounded-[4px] bg-muted px-1.5 py-[2px] text-[10px] font-medium leading-none text-muted-foreground">
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
