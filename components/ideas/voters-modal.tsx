"use client";

import {Loader2, X, ChevronUp} from "lucide-react";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";

import {Button} from "@/components/ui/button";
import {OnlineAvatar} from "@/components/presence/online-avatar";
import {Link} from "@/lib/i18n/routing";
import {getIdeaVoteDetailsAction} from "@/app/[locale]/server-actions";

interface VoterUser {
  user_id: string;
  created_at: string;
  profile: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface VotersModalProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  locale: string;
}

export function VotersModal({open, onClose, ideaId, locale}: VotersModalProps) {
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [voters, setVoters] = useState<VoterUser[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const t = useTranslations("Ideas");

  const titleMap: Record<string, string> = {
    ar: "المؤيدون",
    fr: "Supporteurs",
    en: "Supporters",
  };
  const modalTitle = titleMap[locale] ?? titleMap.en;

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setOffset(0);
    setVoters([]);

    async function loadData() {
      try {
        const res = await getIdeaVoteDetailsAction(ideaId, 50, 0);
        setTotalCount(res.totalCount);
        setVoters(res.voters);
        setHasMore(res.voters.length < res.totalCount);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, ideaId]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offset + 50;
    try {
      const res = await getIdeaVoteDetailsAction(ideaId, 50, nextOffset);
      setVoters((prev) => [...prev, ...res.voters]);
      setOffset(nextOffset);
      setHasMore(voters.length + res.voters.length < res.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex h-[80vh] w-full flex-col rounded-t-2xl bg-card shadow-2xl transition-all sm:h-[500px] sm:max-w-lg sm:rounded-2xl border border-border/80">
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 sm:px-5">
          <h3 className="text-lg font-semibold text-foreground/90">
            {modalTitle}
            {totalCount > 0 ? (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">({totalCount})</span>
            ) : null}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : voters.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <ChevronUp size={32} className="mb-2 opacity-40" />
              <p className="text-sm">{t("noVotesYet") ?? "No votes yet."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {voters.map((v) => {
                const username = v.profile?.username;
                const fullName = v.profile?.full_name ?? username ?? t("unknownAuthor");
                const profileHref = username ? `/profile/${username}` : null;

                return (
                  <div key={v.user_id} className="flex items-center gap-3">
                    {profileHref ? (
                      <Link href={profileHref} onClick={onClose} className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
                        <OnlineAvatar userId={v.user_id} label={fullName} avatarUrl={v.profile?.avatar_url} className="h-10 w-10 shrink-0" />
                      </Link>
                    ) : (
                      <OnlineAvatar userId={v.user_id} label={fullName} avatarUrl={v.profile?.avatar_url} className="h-10 w-10 shrink-0" />
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
                );
              })}

              {hasMore && (
                <div className="pt-2">
                  <Button type="button" variant="outline" className="w-full" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      locale === "ar" ? "تحميل المزيد" : locale === "fr" ? "Charger plus" : "Load more"
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
