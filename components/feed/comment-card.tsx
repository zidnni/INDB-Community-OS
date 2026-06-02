"use client";

import {Trash2} from "lucide-react";
import {useFormStatus} from "react-dom";

import {UserAvatar} from "@/components/layout/user-avatar";
import {Button} from "@/components/ui/button";
import {deleteCommentAction} from "@/app/[locale]/server-actions";

function DeleteButton() {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" disabled={pending}>
      <Trash2 size={12} />
    </Button>
  );
}

export function CommentCard({
  commentId,
  author,
  authorAvatarUrl,
  content,
  timeAgo,
  isOwn,
  locale,
  returnTo,
}: {
  commentId: string;
  author: string;
  authorAvatarUrl?: string | null;
  content: string;
  timeAgo: string;
  isOwn: boolean;
  locale: string;
  returnTo: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3">
      <UserAvatar className="h-7 w-7 shrink-0" label={author} avatarUrl={authorAvatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold">{author}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <p className="text-sm text-muted-foreground">{content}</p>
      </div>
      {isOwn ? (
        <form action={deleteCommentAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="commentId" value={commentId} />
          <DeleteButton />
        </form>
      ) : null}
    </div>
  );
}
