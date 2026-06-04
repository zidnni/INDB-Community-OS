"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {Heart} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

import {createClient} from "@/lib/supabase/client";
import {withLocale} from "@/lib/i18n/paths";
import {toggleReactionAction} from "@/app/[locale]/server-actions";
import type {ReactionType} from "@/types/database";

const REACTIONS: {type: ReactionType; emoji: string}[] = [
  {type: "like", emoji: "\u{1F44D}"},
  {type: "love", emoji: "\u2764\uFE0F"},
  {type: "support", emoji: "\u{1F91D}"},
  {type: "celebrate", emoji: "\u{1F389}"},
  {type: "insightful", emoji: "\u{1F4A1}"},
  {type: "sad", emoji: "\u{1F622}"},
];

export function ReactionButton({
  postId,
  locale,
  returnTo,
  currentReaction,
  likesCount,
}: {
  postId: string;
  locale: string;
  returnTo: string;
  currentReaction?: ReactionType | null;
  likesCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [localReaction, setLocalReaction] = useState<ReactionType | null>(
    currentReaction ?? null,
  );
  const [localTotal, setLocalTotal] = useState(likesCount);
  const router = useRouter();
  const errors = useTranslations("Errors");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync from server when props change (after router.refresh)
  useEffect(() => {
    setLocalReaction(currentReaction ?? null);
    setLocalTotal(likesCount);
  }, [currentReaction, likesCount]);

  // Close picker on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSelect(type: ReactionType) {
    setOpen(false);

    const prevReaction = localReaction;
    const prevTotal = localTotal;
    const newReaction = localReaction === type ? null : type;
    const delta = newReaction ? (localReaction ? 0 : 1) : -1;

    // Optimistic update
    setLocalReaction(newReaction);
    setLocalTotal((c) => Math.max(0, c + delta));

    // Auth check before server call
    const supabase = createClient();
    const {
      data: {user},
    } = await supabase.auth.getUser();
    if (!user) {
      setLocalReaction(prevReaction);
      setLocalTotal(prevTotal);
      router.push(withLocale(`/login?next=${encodeURIComponent(returnTo)}`, locale));
      return;
    }

    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("postId", postId);
    formData.set("reactionType", type);
    formData.set("returnTo", returnTo);

    try {
      await toggleReactionAction(formData);
    } catch {
      setLocalReaction(prevReaction);
      setLocalTotal(prevTotal);
      toast.error(errors("reactionFailed"));
    }
  }

  const currentEmoji = REACTIONS.find((r) => r.type === localReaction)?.emoji;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-sm transition sm:gap-2 sm:px-4 ${
          localReaction
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        {currentEmoji ? (
          <span className="text-xl">{currentEmoji}</span>
        ) : (
          <Heart size={18} className="shrink-0" />
        )}
        <span>{localTotal}</span>
      </button>

      {open ? (
        <div
          ref={pickerRef}
          className="absolute bottom-full start-0 z-50 mb-2 flex max-w-[calc(100vw-2rem)] gap-1 overflow-x-auto rounded-2xl border bg-card p-2 shadow-xl"
        >
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              onClick={() => handleSelect(r.type)}
              className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-2 text-xl transition hover:scale-110 hover:bg-muted ${
                localReaction === r.type
                  ? "bg-primary/10 ring-1 ring-primary"
                  : ""
              }`}
              title={r.type}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
