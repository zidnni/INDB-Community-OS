"use client";

import {Gift, Loader2, MapPin, PackageCheck, Pencil, Share2, Trash2} from "lucide-react";
import {useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import type {ReactNode} from "react";
import {useEffect, useRef, useState} from "react";
import {useFormStatus} from "react-dom";
import {toast} from "sonner";

import {
  deleteCommunityShareAction,
  requestCommunityShareAction,
  shareCommunityShareAction,
  updateCommunityShareStatusAction,
} from "@/app/[locale]/server-actions";
import {TranslateButton} from "@/components/shared/translate-button";
import {UserAvatar} from "@/components/layout/user-avatar";
import {MediaCarousel} from "@/components/media/media-carousel";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Link} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import type {CommunityShareStatus, CommunityShareWithOwner} from "@/types/database";

const statusClassName: Record<CommunityShareStatus, string> = {
  available: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300",
  reserved: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-300",
  given: "border-muted bg-muted text-muted-foreground",
};

function SubmitButton({
  children,
  className,
  variant = "outline",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const {pending} = useFormStatus();

  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending} className={className}>
      {pending ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function FadlaCard({
  share,
  currentUserId,
  locale,
  onEdit,
  compact = false,
}: {
  share: CommunityShareWithOwner;
  currentUserId?: string | null;
  locale: string;
  onEdit?: (share: CommunityShareWithOwner) => void;
  compact?: boolean;
}) {
  const t = useTranslations("Fadla");
  const feed = useTranslations("Feed");
  const searchParams = useSearchParams();
  const [highlight, setHighlight] = useState(false);
  const [sharesCount, setSharesCount] = useState(share.shares_count ?? 0);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const targetItem = searchParams.get("item");
    const focus = searchParams.get("focus");

    if (targetItem !== share.id) return;

    const timer = window.setTimeout(() => {
      if (focus === "requests") {
        const requestsEl = document.getElementById(`fadla-${share.id}-requests`);
        requestsEl?.scrollIntoView({behavior: "smooth", block: "center"});
      } else {
        articleRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
      }

      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 1500);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchParams, share.id]);

  const isOwner = currentUserId === share.owner_id;
  const ownerName = share.owner?.full_name ?? share.owner?.username ?? t("unknownOwner");
  const LOCALE_TO_CONTENT_LANG: Record<string, ContentLanguage> = {ar:"ar",fr:"fr",wo:"wo",ff:"ff",snk:"snk"};
  const uiLanguage: ContentLanguage = LOCALE_TO_CONTENT_LANG[locale] ?? "en";
  const contentLanguage = detectContentLanguage(share.description);
  const canTranslate = contentLanguage !== uiLanguage;
  const createdAt = new Date(share.created_at).toLocaleDateString(
    locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US",
    {month: "short", day: "numeric"},
  );

  return (
    <article
      ref={articleRef}
      id={`fadla-${share.id}`}
      className={`overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_18px_45px_rgba(8,33,56,0.08)] transition-all duration-500 ${
        highlight ? "ring-2 ring-primary/40 bg-primary/5" : ""
      }`}
    >
      {share.images.length > 0 ? (
        <MediaCarousel
          items={share.images.map((image) => ({url: image.url, type: "image", alt: share.title}))}
          alt={share.title}
          aspectClassName={compact ? "aspect-[4/3]" : "aspect-[5/4]"}
          className="rounded-none border-0"
        />
      ) : (
        <div className={cn("flex items-center justify-center bg-gradient-to-br from-primary/10 via-card to-green-100/60 dark:to-green-950/20", compact ? "aspect-[4/3]" : "aspect-[5/4]")}>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-background/80 text-primary shadow-sm">
              <Gift size={30} />
            </div>
            <p className="mt-3 text-sm font-semibold text-muted-foreground">{t("imagePlaceholder")}</p>
          </div>
        </div>
      )}

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                {t(`categories.${share.category}`)}
              </Badge>
              <Badge className={cn("rounded-full px-3 py-1 hover:bg-current/0", statusClassName[share.status])}>
                {share.status === "given" ? t("alreadyGiven") : t(`status.${share.status}`)}
              </Badge>
            </div>
            <h2 className="break-words text-xl font-bold leading-tight sm:text-2xl">{share.title}</h2>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{createdAt}</span>
        </div>

        <p className="break-words text-sm leading-6 text-muted-foreground sm:text-base">{share.description}</p>
        {canTranslate ? (
          <TranslateButton text={share.description} contentType="fadla" contentId={share.id} />
        ) : null}

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {share.location ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <MapPin size={15} />
              {share.location}
            </span>
          ) : null}
          {share.condition ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <PackageCheck size={15} />
              {share.condition}
            </span>
          ) : null}
        </div>

        <div id={`fadla-${share.id}-requests`} className="scroll-mt-24 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <Link href={share.owner?.username ? `/profile/${share.owner.username}` : "/profile"} className="flex min-w-0 items-center gap-2">
            <UserAvatar label={ownerName} avatarUrl={share.owner?.avatar_url} className="h-10 w-10 shrink-0 text-xs" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{ownerName}</span>
              <span className="block text-xs text-muted-foreground">{t("sharedForHelp")}</span>
            </span>
          </Link>

          {!isOwner ? (
            <form action={requestCommunityShareAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="shareId" value={share.id} />
              <input type="hidden" name="returnTo" value="/fadla" />
              <SubmitButton
                variant={share.status === "available" && !share.requested_by_current_user ? "default" : "outline"}
                className="min-h-11 rounded-full px-4"
              >
                {share.status === "given"
                  ? t("alreadyGiven")
                  : share.requested_by_current_user
                    ? t("requested")
                    : t("needThis")}
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {isOwner ? (
          <div className="grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit?.(share)} className="min-h-10 gap-1.5 rounded-full">
              <Pencil size={15} />
              {t("actions.edit")}
            </Button>
            <form action={deleteCommunityShareAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="shareId" value={share.id} />
              <SubmitButton variant="destructive" className="min-h-10 w-full rounded-full">
                <Trash2 size={15} />
                {t("actions.delete")}
              </SubmitButton>
            </form>
            {(["available", "reserved", "given"] as CommunityShareStatus[])
              .filter((status) => status !== share.status)
              .map((status) => (
                <form key={status} action={updateCommunityShareStatusAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="shareId" value={share.id} />
                  <input type="hidden" name="status" value={status} />
                  <SubmitButton className="min-h-10 w-full rounded-full">
                    {t(`actions.mark.${status}`)}
                  </SubmitButton>
                </form>
              ))}
          </div>
        ) : null}

        <div className="flex border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/${locale}/fadla?item=${share.id}`;
              let shared = false;
              if (typeof navigator !== "undefined" && "share" in navigator) {
                try {
                  await (navigator as Navigator).share({url});
                  shared = true;
                } catch {
                }
              }
              if (!shared) {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success(feed("linkCopied"));
                } catch {
                  toast.error(feed("shareFailed"));
                  return;
                }
              }

              setSharesCount((c) => c + 1);
              const formData = new FormData();
              formData.set("shareId", share.id);
              const result = await shareCommunityShareAction(formData);
              if (!result.success && result.error === "unauthorized") {
                setSharesCount((c) => Math.max(0, c - 1));
              }
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Share2 size={16} />
            <span className="tabular-nums">{sharesCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
