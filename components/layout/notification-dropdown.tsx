"use client";

import {AnimatePresence, motion} from "framer-motion";
import {
  Bell,
  Bookmark,
  Heart,
  MessageCircle,
  UserPlus,
  CheckCheck,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        default:
          return n.message ?? "";
      }
    }

    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleNotificationClick(n)}
        className={`flex w-full items-start gap-3 px-4 py-3 text-start text-sm transition hover:bg-muted/60 ${
          !n.read ? "bg-primary/5" : ""
        }`}
      >
        <div className="relative shrink-0">
          <UserAvatar
            label={displayName}
            avatarUrl={n.actor?.avatar_url}
            className="h-9 w-9"
          />
          <div className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-brand-primary text-[8px] text-white">
            <Icon size={10} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-snug text-foreground/90">
            {getMessage()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {timeAgo(n.created_at, locale)}
          </p>
        </div>
        {!n.read ? (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-primary" />
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
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      <AnimatePresence>
        {open ? (
          <>
            {/* Overlay for mobile */}
            <motion.div
              key="overlay"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Mobile: bottom sheet */}
            <motion.div
              key="mobile-sheet"
              initial={{y: "100%"}}
              animate={{y: 0}}
              exit={{y: "100%"}}
              transition={{type: "spring", damping: 30, stiffness: 300}}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[75vh] rounded-t-2xl border border-border/80 bg-card shadow-2xl sm:hidden"
              style={{maxHeight: "75dvh"}}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-card px-4 py-3">
                <h3 className="text-sm font-semibold">{t("title")}</h3>
                <div className="flex items-center gap-2">
                  {hasUnread ? (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <CheckCheck size={14} />
                      {t("markAllRead")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("close")}
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto pb-safe" style={{maxHeight: "calc(75dvh - 52px)"}}>
                {loading && notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">{t("loading")}</div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">{t("empty")}</div>
                ) : (
                  notifications.map(renderNotificationItem)
                )}
              </div>
            </motion.div>

            {/* Desktop: dropdown */}
            <motion.div
              key="desktop-dropdown"
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 8}}
              transition={{duration: 0.2}}
              className="absolute end-0 top-12 z-40 hidden w-[360px] sm:block"
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
                      <CheckCheck size={14} />
                      {t("markAllRead")}
                    </button>
                  ) : null}
                </div>
                <div className="overflow-y-auto" style={{maxHeight: "400px"}}>
                  {loading && notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">{t("loading")}</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">{t("empty")}</div>
                  ) : (
                    notifications.map(renderNotificationItem)
                  )}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
