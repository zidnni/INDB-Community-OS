"use client";

import {AnimatePresence, motion} from "framer-motion";
import {
  Bell,
  BellRing,
  Award,
  Bookmark,
  Gift,
  Heart,
  Lightbulb,
  MessageCircle,
  UserPlus,
  CheckCheck,
  X,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useTranslations} from "next-intl";

import {UserAvatar} from "@/components/layout/user-avatar";
import {Button} from "@/components/ui/button";
import {createClient} from "@/lib/supabase/client";
import {useRouter} from "@/lib/i18n/routing";
import type {NotificationWithActor} from "@/types/database";

const PAGE_SIZE = 20;

function timeAgo(dateStr: string, locale: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return locale === "ar" ? "الآن" : "now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}${locale === "ar" ? "د" : "m"}`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}${locale === "ar" ? "س" : "h"}`;
  }
  if (diffSec < 2592000) {
    const d = Math.floor(diffSec / 86400);
    return `${d}${locale === "ar" ? "ي" : "d"}`;
  }
  const month = Math.floor(diffSec / 2592000);
  return `${month}${locale === "ar" ? "ش" : "mo"}`;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "follow":
      return UserPlus;
    case "reaction":
      return Heart;
    case "comment":
    case "idea_comment":
    case "memory_comment":
    case "fadla_message":
    case "idea_message":
    case "idea_group_message":
      return MessageCircle;
    case "save":
      return Bookmark;
    case "credit":
      return Award;
    case "community_share_request":
    case "fadla_request":
    case "fadla_completed":
    case "fadla_request_declined":
      return Gift;
    case "idea_support":
    case "idea_participate_request":
    case "idea_participant_accepted":
    case "idea_participant_declined":
    case "idea_status_change":
    case "idea_group_updated":
    case "idea_group_removed":
    case "idea_group_left":
    case "idea_completed":
      return Lightbulb;
    default:
      return Bell;
  }
}

export function NotificationDropdown({
  locale,
  initialUnreadCount = 0,
}: {
  locale: string;
  initialUnreadCount?: number;
}) {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialUnreadCount !== undefined) {
      setUnreadCount(initialUnreadCount);
    }
  }, [initialUnreadCount]);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialCount() {
      const {data: {user}} = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const {count} = await supabase
        .from("notifications")
        .select("id", {count: "exact", head: true})
        .eq("user_id", user.id)
        .eq("read", false);

      if (!cancelled) setUnreadCount(count ?? 0);
    }

    fetchInitialCount();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const {data: {user}} = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const {data, error} = await supabase
        .from("notifications")
        .select("*, actor:profiles!actor_id(id, username, full_name, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", {ascending: false})
        .limit(PAGE_SIZE + 1);

      if (cancelled) return;
      if (!error) {
        const rows = ((data as unknown as NotificationWithActor[]) ?? []);
        setNotifications(rows.slice(0, PAGE_SIZE));
        setHasMore(rows.length > PAGE_SIZE);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [open, supabase]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;
    let cancelled = false;

    async function fetchNotification(notificationId: string) {
      const {data} = await supabase
        .from("notifications")
        .select("*, actor:profiles!actor_id(id, username, full_name, avatar_url)")
        .eq("id", notificationId)
        .single();

      return data as unknown as NotificationWithActor | null;
    }

    function upsertNotification(notification: NotificationWithActor) {
      const isUnread = !notification.read;
      setUnreadCount((prev) => prev + (isUnread ? 1 : 0));
      setNotifications((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== notification.id);
        return [notification, ...withoutCurrent].slice(0, PAGE_SIZE);
      });
    }

    async function setupRealtime() {
      const {data: {user}} = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const channelName = `notifications-realtime-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as {id?: string; read?: boolean};
              if (oldRow.id) {
                setNotifications((prev) => prev.filter((item) => item.id !== oldRow.id));
                if (!oldRow.read) setUnreadCount((prev) => Math.max(0, prev - 1));
              }
              return;
            }

            const row = payload.new as {id?: string; read?: boolean};
            if (!row.id) return;

            const notification = await fetchNotification(row.id);
            if (notification && openRef.current) {
              upsertNotification(notification);
            }
          },
        )
        .subscribe();
    }

    setupRealtime();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(mobilePanelRef.current && mobilePanelRef.current.contains(event.target as Node))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleNotificationClick(n: NotificationWithActor) {
    if (!n.read) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? {...item, read: true} : item)),
      );
      void supabase
        .from("notifications")
        .update({read: true})
        .eq("id", n.id)
        .then(({error}) => {
          if (error) console.error("mark notification read error", error);
        });
    }

    setOpen(false);

    if (n.entity_type && n.entity_id) {
      const metadata = (n.metadata ?? {}) as {commentId?: string; conversationId?: string};
      const commentQuery = metadata.commentId ? `&comment=${encodeURIComponent(metadata.commentId)}` : "";
      // If notification has a conversationId, navigate directly to messages
      if (metadata.conversationId) {
        router.push(`/messages?conversation=${metadata.conversationId}`);
        return;
      }
      switch (n.entity_type) {
        case "memory": {
          const memoryFocus = n.type === "reaction" ? "reactions" : n.type === "memory_comment" ? "comments" : "";
          const memoryFocusQuery = memoryFocus ? `&focus=${memoryFocus}` : "";
          const memoryHash = memoryFocus === "reactions"
            ? `#memory-${n.entity_id}-reactions`
            : metadata.commentId
              ? `#comment-${metadata.commentId}`
              : `#memory-${n.entity_id}`;
          router.push(`/memory/${n.entity_id}?notification=${n.id}${commentQuery}${memoryFocusQuery}${memoryHash}`);
          return;
        }
        case "post": {
          const focusParam = n.type === "reaction" ? "reactions" : n.type === "comment" ? "comments" : "";
          const focusQuery = focusParam ? `&focus=${focusParam}` : "";
          const hashTarget = focusParam === "reactions" 
            ? `#post-${n.entity_id}-reactions` 
            : metadata.commentId 
              ? `#comment-${metadata.commentId}` 
              : `#post-${n.entity_id}-comments`;
          router.push(`/feed?post=${n.entity_id}&notification=${n.id}${commentQuery}${focusQuery}${hashTarget}`);
          return;
        }
        case "idea": {
          const ideaFocus = n.type === "idea_comment"
            ? "comments"
            : n.type === "idea_participate_request"
              ? "requests"
              : ["idea_participant_accepted", "idea_message", "idea_status_change", "idea_group_message", "idea_group_updated", "idea_group_removed", "idea_group_left", "idea_completed"].includes(n.type)
                ? "discussion"
                : n.type === "idea_participant_declined"
                  ? "participation"
                : "";
          const ideaFocusQuery = ideaFocus ? `&focus=${ideaFocus}` : "";
          const ideaHash = ideaFocus === "comments" && metadata.commentId
            ? `#comment-${metadata.commentId}`
            : `#idea-${n.entity_id}`;
          router.push(`/ideas?idea=${n.entity_id}&notification=${n.id}${commentQuery}${ideaFocusQuery}${ideaHash}`);
          return;
        }
        case "credit":
          router.push("/profile");
          return;
        case "community_share": {
          if (n.type === "share") {
            router.push(`/fadla?item=${n.entity_id}&notification=${n.id}#fadla-${n.entity_id}`);
            return;
          }
          let focusParam = "";
          if (n.type === "fadla_request") focusParam = "&focus=requests";
          else if (["fadla_message", "fadla_receiver_confirmed", "fadla_sender_confirmed", "fadla_both_completed", "fadla_completed", "fadla_request_accepted", "fadla_request_declined"].includes(n.type)) focusParam = "&focus=discussion";
          router.push(`/fadla?item=${n.entity_id}&notification=${n.id}${focusParam}#fadla-${n.entity_id}`);
          return;
        }
        case "project":
          router.push("/projects");
          return;
        case "event":
          router.push("/events");
          return;
        case "poll":
          router.push("/polls");
          return;
      }
    }

    if (n.type === "follow") {
      const username = n.actor?.username;
      router.push(username ? `/profile/${username}` : `/profile/${n.actor_id ?? ""}`);
    } else {
      router.push("/feed");
    }
  }

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
      setLoadingMore(false);
      return;
    }

    const from = notifications.length;
    const to = from + PAGE_SIZE;
    const {data, error} = await supabase
      .from("notifications")
      .select("*, actor:profiles!actor_id(id, username, full_name, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", {ascending: false})
      .range(from, to);

    if (!error) {
      const rows = ((data as unknown as NotificationWithActor[]) ?? []);
      setNotifications((prev) => [...prev, ...rows.slice(0, PAGE_SIZE)]);
      setHasMore(rows.length > PAGE_SIZE);
    }
    setLoadingMore(false);
  }

  async function handleMarkAllRead() {
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({read: true})
      .eq("user_id", user.id)
      .eq("read", false);

    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({...n, read: true})));
  }

  const hasUnread = unreadCount > 0;

  function renderNotificationItem(n: NotificationWithActor) {
    const Icon = getNotificationIcon(n.type);
    const metadata = (n.metadata ?? {}) as {
      actorName?: unknown;
      actorAvatarUrl?: unknown;
      senderName?: unknown;
      senderAvatarUrl?: unknown;
    };
    const metadataName =
      typeof metadata.actorName === "string"
        ? metadata.actorName
        : typeof metadata.senderName === "string"
          ? metadata.senderName
          : null;
    const metadataAvatarUrl =
      typeof metadata.actorAvatarUrl === "string"
        ? metadata.actorAvatarUrl
        : typeof metadata.senderAvatarUrl === "string"
          ? metadata.senderAvatarUrl
          : null;
    const displayName = n.actor?.full_name ?? n.actor?.username ?? metadataName ?? t("someone");
    const displayAvatarUrl = n.actor?.avatar_url ?? metadataAvatarUrl;

    function getMessage() {
      const actorName = displayName;
      switch (n.type) {
        case "follow":
          return t("startedFollowing", {actorName});
        case "reaction":
          return t("reactedToPost", {actorName});
        case "comment":
          return t("commentedOnPost", {actorName});
        case "idea_comment":
          return t("commentedOnYourIdea", {actorName});
        case "memory_comment":
          return t("commentedOnYourMemory", {actorName});
        case "credit":
          return t("creditAwarded", {points: n.message ?? ""});
        case "community_share_request":
        case "fadla_request":
          return t("fadlaRequested", {actorName});
        case "fadla_message":
          return t("fadlaMessage", {actorName});
        case "fadla_completed":
        case "fadla_both_completed":
          return t("fadlaCompleted", {actorName});
        case "fadla_receiver_confirmed":
          return t("fadlaReceiverConfirmed", {actorName});
        case "fadla_sender_confirmed":
          return t("fadlaSenderConfirmed", {actorName});
        case "fadla_request_accepted":
          return t("fadlaRequestAccepted", {actorName});
        case "fadla_request_declined":
          return t("fadlaRequestDeclined", {actorName});
        case "idea_support":
          return t("ideaSupported", {actorName});
        case "idea_participate_request":
          return t("ideaParticipateRequest", {actorName});
        case "idea_participant_accepted":
          return t("ideaParticipantAccepted", {actorName});
        case "idea_participant_declined":
          return t("ideaParticipantDeclined", {actorName});
        case "idea_message":
          return t("ideaMessage", {actorName});
        case "idea_group_message":
          return t("ideaGroupMessage", {actorName});
        case "idea_group_updated":
          return t("ideaGroupUpdated", {actorName});
        case "idea_group_removed":
          return t("ideaGroupRemoved", {actorName});
        case "idea_group_left":
          return t("ideaGroupLeft", {actorName});
        case "idea_status_change":
          return t("ideaStatusChange", {actorName});
        case "idea_completed":
          return t("ideaCompleted", {actorName});
        case "share":
          return n.entity_type === "memory"
            ? t("sharedYourMemory", {actorName})
            : t("sharedYourIdea", {actorName});
        default:
          return n.title ?? n.message ?? "";
      }
    }

    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleNotificationClick(n)}
        className={`flex w-full items-start gap-3 px-4 py-4 text-start text-base transition active:bg-muted/80 hover:bg-muted/60 ${
          !n.read ? "bg-primary/[0.06]" : ""
        }`}
      >
        <div className="relative shrink-0">
          <UserAvatar
            label={displayName}
            avatarUrl={displayAvatarUrl}
            className="h-10 w-10"
          />
          <div className="absolute -bottom-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] text-primary-foreground">
            <Icon size={12} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug text-foreground/90">
            {getMessage()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {timeAgo(n.created_at, locale)}
          </p>
        </div>
        {!n.read ? (
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
        ) : null}
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("button")}
        onClick={() => setOpen((prev) => !prev)}
        className="relative min-h-11 min-w-11 rounded-full p-0"
        style={{touchAction: "manipulation"}}
      >
          <Bell size={22} />
        {unreadCount > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {/* Mobile: bottom sheet panel */}
      {open && mounted ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/40 animate-fade-in md:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            ref={mobilePanelRef}
            className="fixed inset-x-0 bottom-0 z-[9999] flex max-h-[85vh] flex-col rounded-t-2xl bg-background shadow-2xl animate-slide-up md:hidden"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 pb-3 pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted/80"
              >
                <X size={20} />
              </button>
              <h2 className="text-base font-semibold">{t("title")}</h2>
              {hasUnread ? (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary transition active:bg-primary/10"
                >
                  <CheckCheck size={18} />
                  {t("markAllRead")}
                </button>
              ) : (
                <div className="w-20" />
              )}
            </div>
            <div className="flex-1 overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {loading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                  <BellRing size={36} className="mb-4 animate-pulse text-muted-foreground/30" />
                  <p className="text-sm">{t("loading")}</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                  <BellRing size={48} className="mb-5 text-muted-foreground/25" />
                  <p className="text-sm">{t("empty")}</p>
                </div>
              ) : (
                <>
                  {notifications.map(renderNotificationItem)}
                  {hasMore ? (
                    <div className="px-4 py-3">
                      <Button type="button" variant="outline" className="w-full" onClick={handleLoadMore} disabled={loadingMore}>
                        {loadingMore ? t("loading") : t("loadMore")}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>,
        document.body,
      ) : null}

      {/* Desktop: dropdown */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="desktop-dropdown"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 8}}
            transition={{duration: 0.2}}
            className="absolute end-0 top-12 z-50 hidden w-[360px] md:block"
          >
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold">{t("title")}</h3>
                {hasUnread ? (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <CheckCheck size={16} />
                    {t("markAllRead")}
                  </button>
                ) : null}
              </div>
              <div className="overflow-y-auto" style={{maxHeight: "400px"}}>
                {loading && notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <BellRing size={24} className="mb-2 animate-pulse text-muted-foreground/40" />
                    <p className="text-xs">{t("loading")}</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <BellRing size={28} className="mb-2 text-muted-foreground/30" />
                    <p className="text-xs">{t("empty")}</p>
                  </div>
                ) : (
                  <>
                    {notifications.map(renderNotificationItem)}
                    {hasMore ? (
                      <div className="px-4 py-3">
                        <Button type="button" variant="outline" className="w-full" onClick={handleLoadMore} disabled={loadingMore}>
                          {loadingMore ? t("loading") : t("loadMore")}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
