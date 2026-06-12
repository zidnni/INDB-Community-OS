"use client";

import {Loader2, X} from "lucide-react";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";

import {Button} from "@/components/ui/button";
import {UserAvatar} from "@/components/layout/user-avatar";
import {Link} from "@/lib/i18n/routing";
import {getMemoryReactionDetailsAction} from "@/app/[locale]/server-actions";
import type {MemoryReactionType} from "@/types/database";

const REACTIONS: {type: MemoryReactionType; emoji: string}[] = [
  {type: "like", emoji: "\u{1F44D}"},
  {type: "love", emoji: "\u2764\uFE0F"},
  {type: "support", emoji: "\u{1F91D}"},
  {type: "celebrate", emoji: "\u{1F389}"},
  {type: "insightful", emoji: "\u{1F4A1}"},
  {type: "sad", emoji: "\u{1F622}"},
];

interface ReactionUser {
  user_id: string;
  reaction_type: MemoryReactionType;
  created_at: string;
  profile: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface MemoryReactionModalProps {
  open: boolean;
  onClose: () => void;
  memoryId: string;
  locale: string;
}

export function MemoryReactionModal({open, onClose, memoryId, locale}: MemoryReactionModalProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [groupedCounts, setGroupedCounts] = useState<Record<string, number>>({});
  const [reactingUsers, setReactingUsers] = useState<ReactionUser[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const t = useTranslations("Feed");

  const titleMap: Record<string, string> = {
    ar: "\u0627\u0644\u062A\u0641\u0627\u0639\u0644\u0627\u062A",
    fr: "R\u00e9actions",
    en: "Reactions",
  };
  const modalTitle = titleMap[locale] ?? titleMap.en;

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setOffset(0);
    setReactingUsers([]);

    async function loadData() {
      try {
        const res = await getMemoryReactionDetailsAction(memoryId, 50, 0);
        setTotalCount(res.totalCount);
        setGroupedCounts(res.groupedCounts);
        setReactingUsers(res.reactingUsers);
        setHasMore(res.reactingUsers.length < res.totalCount);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, memoryId]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offset + 50;
    try {
      const res = await getMemoryReactionDetailsAction(memoryId, 50, nextOffset);
      setReactingUsers((prev) => [...prev, ...res.reactingUsers]);
      setOffset(nextOffset);
      setHasMore(reactingUsers.length + res.reactingUsers.length < res.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredUsers = reactingUsers.filter((u) => {
    if (activeTab === "all") return true;
    return u.reaction_type === activeTab;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex h-[80vh] w-full flex-col rounded-t-2xl bg-card shadow-2xl transition-all sm:h-[600px] sm:max-w-lg sm:rounded-2xl border border-border/80">
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 sm:px-5">
          <h3 className="text-lg font-semibold text-foreground/90">{modalTitle}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border/60 overflow-x-auto px-4 py-2 scrollbar-none">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition shrink-0 ${
              activeTab === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {locale === "ar" ? "\u0627\u0644\u0643\u0644" : "All"} ({totalCount})
          </button>
          {REACTIONS.map((r) => {
            const count = groupedCounts[r.type] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={r.type}
                onClick={() => setActiveTab(r.type)}
                className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition shrink-0 ${
                  activeTab === r.type ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span>{r.emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">
                {locale === "ar"
                  ? "\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0641\u0627\u0639\u0644\u0627\u062A \u0628\u0639\u062F."
                  : locale === "fr"
                    ? "Aucune r\u00e9action pour le moment."
                    : "No reactions yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((ru) => {
                const username = ru.profile?.username;
                const fullName = ru.profile?.full_name ?? username ?? t("unknownAuthor");
                const profileHref = username ? `/profile/${username}` : null;
                const emoji = REACTIONS.find((r) => r.type === ru.reaction_type)?.emoji;

                return (
                  <div key={ru.user_id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {profileHref ? (
                        <Link href={profileHref} onClick={onClose} className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
                          <UserAvatar label={fullName} avatarUrl={ru.profile?.avatar_url} className="h-10 w-10 shrink-0" />
                        </Link>
                      ) : (
                        <UserAvatar label={fullName} avatarUrl={ru.profile?.avatar_url} className="h-10 w-10 shrink-0" />
                      )}
                      <div>
                        {profileHref ? (
                          <Link href={profileHref} onClick={onClose} className="text-sm font-semibold text-foreground/90 transition hover:text-primary hover:underline">
                            {fullName}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-foreground/90">{fullName}</p>
                        )}
                        {username ? (
                          <p className="text-xs text-muted-foreground">@{username}</p>
                        ) : null}
                      </div>
                    </div>
                    {emoji ? <span className="text-xl select-none">{emoji}</span> : null}
                  </div>
                );
              })}

              {hasMore && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      locale === "ar"
                        ? "\u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0632\u064A\u062F"
                        : locale === "fr"
                          ? "Charger plus"
                          : "Load more"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
