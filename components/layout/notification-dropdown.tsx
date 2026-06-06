"use client";

import {AnimatePresence, motion} from "framer-motion";
import {
  Bell,
  BellRing,
  Bookmark,
  Heart,
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
      return MessageCircle;
    case "save":
      return Bookmark;
    default:
      return Bell;
  }
}

export function NotificationDropdown({locale}: {locale: string}) {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialCount() {
      const {data: {user}} = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const {count} = await supabase
        .from("notifications")
        .select("*", {count: "exact", head: true})
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
        .limit(20);

      const {count} = await supabase
        .from("notifications")
        .select("*", {count: "exact", head: true})
        .eq("user_id", user.id)
        .eq("read", false);

      if (cancelled) return;
      if (!error) {
        setNotifications((data as unknown as NotificationWithActor[]) ?? []);
      }
      setUnreadCount(count ?? 0);
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [open, supabase]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    async function pollCount() {
      const {data: {user}} = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const {count} = await supabase
        .from("notifications")
        .select("*", {count: "exact", head: true})
        .eq("user_id", user.id)
        .eq("read", false);

      if (!cancelled) setUnreadCount(count ?? 0);
    }

    async function setupRealtime() {
      const {data: {user}} = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            setUnreadCount((c) => c + 1);

            if (openRef.current) {
              const {data} = await supabase
                .from("notifications")
                .select("*, actor:profiles!actor_id(id, username, full_name, avatar_url)")
                .eq("id", payload.new.id)
                .single();

              if (data) {
                setNotifications(
                  (prev) => [data as unknown as NotificationWithActor, ...prev].slice(0, 20),
                );
              }
            }
          },
        )
        .subscribe();

      interval = setInterval(pollCount, 30000);
    }

    setupRealtime();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
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
      await supabase.from("notifications").update({read: true}).eq("id", n.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? {...item, read: true} : item)),
      );
    }

    setOpen(false);

    if (n.entity_type && n.entity_id) {
      switch (n.entity_type) {
        case "memory":
          router.push(`/memory/${n.entity_id}`);
          return;
        case "post":
          router.push(`/feed#post-${n.entity_id}`);
          return;
        case "idea":
          router.push("/ideas");
          return;
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

  const hasUnread = notifications.some((n) => !n.read);

  function renderNotificationItem(n: NotificationWithActor) {
    const Icon = getNotificationIcon(n.type);
    const displayName = n.actor?.full_name ?? n.actor?.username ?? t("someone");

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
        default:
          return n.message ?? "";
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
            avatarUrl={n.actor?.avatar_url}
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

      {/* Mobile: full-screen panel */}
      {open && mounted ? createPortal(
        <div ref={mobilePanelRef} className="fixed inset-0 z-[9999] flex flex-col bg-background md:hidden">
          <div
            className="flex items-center justify-between border-b border-border/60 bg-background px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X size={20} />
            </button>
            <h2 className="text-base font-semibold">{t("title")}</h2>
            {hasUnread ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                <CheckCheck size={18} />
                {t("markAllRead")}
              </button>
            ) : (
              <div className="w-20" />
            )}
          </div>
          <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
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
              notifications.map(renderNotificationItem)
            )}
          </div>
        </div>,
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
                  notifications.map(renderNotificationItem)
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
