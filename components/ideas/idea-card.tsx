"use client";

import {motion} from "framer-motion";
import {CalendarDays, Edit3, Lightbulb, Share2, Trash2} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";
import {toast} from "sonner";

import {deleteIdeaAction, shareIdeaAction} from "@/app/[locale]/server-actions";
import {IdeaComments} from "@/components/ideas/idea-comments";
import {VoteButton} from "@/components/ideas/vote-button";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Link} from "@/lib/i18n/routing";
import type {IdeaBadge, IdeaWithAuthor} from "@/types/database";

interface IdeaCardProps {
  idea: IdeaWithAuthor;
  totalUsers?: number;
}

function AuthorAvatar({author}: {author: IdeaWithAuthor["author"]}) {
  if (!author) return null;

  if (author.avatar_url) {
    return (
      <img
        src={author.avatar_url}
        alt=""
        className="size-5 rounded-full object-cover shrink-0"
      />
    );
  }

  const initial = (author.full_name ?? author.username ?? "?").charAt(0).toUpperCase();
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-[#0F4C75] to-[#27C5D8] text-[10px] font-bold text-white shrink-0">
      {initial}
    </span>
  );
}

function DeleteIdeaButton() {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={pending}>
      <Trash2 size={14} />
    </Button>
  );
}

export function IdeaCard({idea, totalUsers}: IdeaCardProps) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const authorName = idea.author?.full_name ?? idea.author?.username ?? t("unknownAuthor");
  const authorUsername = idea.author?.username;

  const ideaExtra = idea as IdeaWithAuthor & {supportPercentage?: number; badge?: IdeaBadge};
  const supportPercentage = ideaExtra.supportPercentage ?? 0;
  const badge = ideaExtra.badge ?? "new_idea";

  const categoryName = idea.category
    ? locale === "ar"
      ? idea.category.name_ar
      : locale === "fr"
        ? idea.category.name_fr
        : idea.category.name_en
    : null;

  async function handleShare() {
    const url = `${window.location.origin}/${window.location.pathname.split("/")[1]}/ideas?id=${idea.id}`;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator).share({url});
        return;
      } catch {
        // user cancelled, do nothing
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied") ?? "Link copied");
    } catch {
      toast.error(t("shareFailed") ?? "Unable to share");
      return;
    }

    const formData = new FormData();
    formData.set("ideaId", idea.id);
    formData.set("locale", locale);
    const result = await shareIdeaAction(formData);
    if (!result.success && result.error === "unauthorized") {
      window.location.href = `/${locale}/login?next=/ideas`;
    }
  }

  const authorContent = (
    <span className="inline-flex items-center gap-1.5">
      <AuthorAvatar author={idea.author} />
      <span className="truncate max-w-[120px] sm:max-w-[180px]">{authorName}</span>
    </span>
  );

  return (
    <motion.article
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.28, ease: "easeOut"}}
    >
      <Card className="overflow-hidden border-border/70 shadow-[0_14px_34px_rgba(8,33,56,0.08)]">
        <div className="bg-red-500 text-white text-center text-xs font-bold py-1">DEBUG IDEA CARD - {idea.id.slice(0,8)}</div>
        {idea.image_url ? (
          <div className="relative h-48 w-full overflow-hidden">
            <img src={idea.image_url} alt={idea.title} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <CardHeader className="pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="inline-flex items-center gap-2 text-[15px] sm:text-base min-w-0">
              <Lightbulb size={16} className="shrink-0" />
              <span className="truncate">{idea.title}</span>
            </CardTitle>
            <div className="flex items-center gap-0.5 shrink-0">
              <Link href={`/ideas/submit?id=${idea.id}`}>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                  <Edit3 size={14} />
                </Button>
              </Link>
              <form
                action={deleteIdeaAction}
                onSubmit={(e) => { if (!window.confirm(t("deleteConfirm"))) e.preventDefault(); }}
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="ideaId" value={idea.id} />
                <input type="hidden" name="returnTo" value="/ideas" />
                <DeleteIdeaButton />
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 sm:space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{idea.description}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {authorUsername ? (
              <Link href={`/profile/${authorUsername}`} className="hover:text-foreground transition-colors">
                {authorContent}
              </Link>
            ) : (
              authorContent
            )}
            {categoryName ? (
              <span className="inline-flex items-center gap-1.5">
                <Lightbulb size={13} />
                {categoryName}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} />
              {new Date(idea.created_at).toLocaleDateString(locale)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <VoteButton
              ideaId={idea.id}
              votes={idea.votes_count}
              supportPercentage={supportPercentage}
              badge={badge}
              totalUsers={totalUsers ?? 0}
            />
            <IdeaComments ideaId={idea.id} />
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Share2 size={14} />
              {t("share")}
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
}
