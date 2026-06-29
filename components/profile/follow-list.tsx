"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import Image from "next/image";
import {ArrowLeft, Loader2, MessageCircle, Search, UserRound, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

import {getFollowersAction, getFollowingAction} from "@/lib/actions/follow-list";
import {toggleFollowAction} from "@/app/[locale]/server-actions";
import {MessageButton} from "@/components/messages/message-button";
import {OnlineDot} from "@/components/presence";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Skeleton} from "@/components/ui/skeleton";
import {useRouter} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {cn} from "@/lib/utils/cn";
import type {FollowUser} from "@/lib/data/follows";

type ListType = "followers" | "following";

interface FollowListProps {
  targetUserId: string;
  currentUserId: string | null | undefined;
  locale: string;
  type: ListType;
  isOpen: boolean;
  onClose: () => void;
  onFollowChange?: () => void;
}

const PAGE_SIZE = 30;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function UserSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
    </div>
  );
}

export function FollowList({
  targetUserId,
  currentUserId,
  locale,
  type,
  isOpen,
  onClose,
  onFollowChange,
}: FollowListProps) {
  const t = useTranslations("Follow");
  const tProfile = useTranslations("Profile");
  const tProfileAbout = useTranslations("ProfileAbout");
  const toasts = useTranslations("Toasts");
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [canView, setCanView] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set());

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchUsers = useCallback(async (pageNum: number, query: string, append: boolean) => {
    setLoading(true);
    const fetcher = type === "followers" ? getFollowersAction : getFollowingAction;
    const result = await fetcher(targetUserId, pageNum, query);

    if (!result.canView) {
      setCanView(false);
      setInitialLoading(false);
      setLoading(false);
      return;
    }

    setCanView(true);
    setUsers((prev) => (append ? [...prev, ...result.data] : result.data));
    setHasMore(result.data.length >= PAGE_SIZE);
    setInitialLoading(false);
    setLoading(false);
  }, [targetUserId, type]);

  useEffect(() => {
    if (!isOpen) return;
    setPage(1);
    setUsers([]);
    setHasMore(true);
    setInitialLoading(true);
    setCanView(true);
    setSearchQuery("");
    setSearchInput("");
    void fetchUsers(1, "", false);
  }, [isOpen, type, targetUserId, fetchUsers]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
      setUsers([]);
      setInitialLoading(true);
      void fetchUsers(1, value, false);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (!el) return;

    function handleScroll() {
      if (loading || !hasMore) return;
      const st = el!.scrollTop;
      const sh = el!.scrollHeight;
      const ch = el!.clientHeight;
      if (sh - st - ch < 200) {
        const nextPage = page + 1;
        setPage(nextPage);
        void fetchUsers(nextPage, searchQuery, true);
      }
    }

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, page, searchQuery, fetchUsers, isOpen]);

  async function handleToggleFollow(userId: string) {
    if (!currentUserId) {
      toast.info(t("loginToFollow"));
      return;
    }

    setPendingFollows((prev) => new Set(prev).add(userId));
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("profileId", userId);

    const result = await toggleFollowAction(formData);
    setPendingFollows((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });

    if (!result.success || result.following == null) {
      toast.error(t("failed"));
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? {...u, is_following: result.following!} : u)),
    );
    toast.success(result.following ? t("followedToast") : t("unfollowedToast"));
    onFollowChange?.();
    router.refresh();
  }

  const VALID_LEVELS = new Set(["community_supporter", "active_contributor", "community_builder", "community_champion", "guardian_of_nouadhibou"]);

  function getLevelLabel(level: string | null | undefined): string {
    if (!level || !VALID_LEVELS.has(level)) return tProfileAbout("communityLevel.unknown");
    return tProfileAbout(`communityLevel.${level}`);
  }

  function navigateToProfile(username: string) {
    router.push(`/profile/${username}`);
  }

  function handleCardKeyDown(e: React.KeyboardEvent, username: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigateToProfile(username);
    }
  }

  const title = type === "followers" ? t("followers") : t("followingCount");
  const searchPlaceholder = type === "followers" ? t("searchFollowers") : t("searchFollowing");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 flex w-full flex-col bg-background",
          "h-dvh sm:h-auto sm:max-h-[85vh] sm:w-[480px] sm:rounded-2xl sm:border sm:border-border/70 sm:shadow-2xl",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft size={20} className="sm:hidden" />
            <X size={20} className="hidden sm:block" />
          </button>
          <h2 className="text-lg font-black">{title}</h2>
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 py-3">
          <div className="relative">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 rounded-xl border-border bg-muted/50 ps-9 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-safe">
          {initialLoading ? (
            <div className="space-y-1 py-2">
              {Array.from({length: 8}).map((_, i) => <UserSkeleton key={i} />)}
            </div>
          ) : !canView ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Lock size={40} className="mb-4 text-muted-foreground/40" />
              <p className="text-base font-black text-foreground">{t("listPrivate")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("listPrivateDesc")}</p>
              <Button onClick={onClose} variant="outline" className="mt-6 rounded-full px-6">
                {t("back")}
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <UserRound size={40} className="mb-4 text-muted-foreground/40" />
              <p className="text-base font-black text-foreground">
                {type === "followers" ? t("noFollowers") : t("noFollowing")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {users.map((user) => (
                <div
                  key={user.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToProfile(user.username)}
                  onKeyDown={(e) => handleCardKeyDown(e, user.username)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition",
                    "cursor-pointer",
                    "hover:bg-muted/30 hover:shadow-sm",
                    "active:bg-muted/50",
                    "focus-visible:outline-none focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/50",
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.full_name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {getInitials(user.full_name)}
                      </div>
                    )}
                    <OnlineDot userId={user.id} className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 border-2 border-background" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{user.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{user.username}
                      <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                        {getLevelLabel(user.community_level)}
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex shrink-0 items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {currentUserId && user.id !== currentUserId ? (
                      <>
                        {user.can_message ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <MessageButton targetUserId={user.id} />
                          </div>
                        ) : null}
                        {user.is_following ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFollow(user.id);
                            }}
                            disabled={pendingFollows.has(user.id)}
                            className="rounded-full px-3 text-xs"
                          >
                            {pendingFollows.has(user.id) ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              t("following")
                            )}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFollow(user.id);
                            }}
                            disabled={pendingFollows.has(user.id)}
                            className="rounded-full px-3 text-xs"
                          >
                            {pendingFollows.has(user.id) ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              t("follow")
                            )}
                          </Button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              ))}

              {/* Load more indicator */}
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : null}

              {!hasMore && users.length > 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{t("endOfList")}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Lock({size, className}: {size?: number; className?: string}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
