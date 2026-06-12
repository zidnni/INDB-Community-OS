"use client";

import {useEffect, useRef, useState} from "react";
import {Heart} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

import {reactToMemoryAction} from "@/app/[locale]/server-actions";
import type {MemoryReactionType} from "@/types/database";

export const REACTIONS: {type: MemoryReactionType; emoji: string}[] = [
  {type: "like", emoji: "\u{1F44D}"},
  {type: "love", emoji: "\u2764\uFE0F"},
  {type: "support", emoji: "\u{1F91D}"},
  {type: "celebrate", emoji: "\u{1F389}"},
  {type: "insightful", emoji: "\u{1F4A1}"},
  {type: "sad", emoji: "\u{1F622}"},
];

export function MemoryReactions({
  memoryId,
  locale,
  initialCounts,
  initialUserReaction,
  className,
  onCountsChange,
  onUserReactionChange,
}: {
  memoryId: string;
  locale: string;
  initialCounts?: Record<string, number>;
  initialUserReaction?: MemoryReactionType | null;
  className?: string;
  onCountsChange?: (counts: Record<string, number>) => void;
  onUserReactionChange?: (reaction: MemoryReactionType | null) => void;
}) {
  const t = useTranslations("Feed");
  const errors = useTranslations("Errors");
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts ?? {});
  const [userReaction, setUserReaction] = useState<MemoryReactionType | null>(initialUserReaction ?? null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCounts(initialCounts ?? {});
    setUserReaction(initialUserReaction ?? null);
  }, [initialCounts, initialUserReaction]);

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

  const countsTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const currentEmoji = REACTIONS.find((r) => r.type === userReaction)?.emoji;
  const reactionLabel = userReaction ? t(`reactions.${userReaction}`) : t("reactions.like");

  async function handleSelect(type: MemoryReactionType) {
    setOpen(false);
    if (pending) return;
    setPending(true);

    const formData = new FormData();
    formData.set("memoryId", memoryId);
    formData.set("reactionType", userReaction === type ? "" : type);

    const prevReaction = userReaction;
    const prevCounts = {...counts};

    if (userReaction === type) {
      setUserReaction(null);
      setCounts((c) => ({...c, [type]: Math.max((c[type] ?? 0) - 1, 0)}));
    } else {
      const newCounts = {...counts};
      if (userReaction) {
        newCounts[userReaction] = Math.max((newCounts[userReaction] ?? 0) - 1, 0);
      }
      newCounts[type] = (newCounts[type] ?? 0) + 1;
      setCounts(newCounts);
      setUserReaction(type);
    }

    const result = await reactToMemoryAction(formData);

    if (!result.success) {
      setUserReaction(prevReaction);
      setCounts(prevCounts);
      if (result.error === "unauthorized") {
        window.location.href = `/${locale}/login`;
        setPending(false);
        return;
      }
      toast.error(errors("reactionFailed") ?? "Reaction failed");
    } else {
      if (result.reaction_counts) {
        setCounts(result.reaction_counts);
        onCountsChange?.(result.reaction_counts);
      }
      setUserReaction(result.reaction ?? null);
      onUserReactionChange?.(result.reaction ?? null);
    }

    setPending(false);
  }

  return (
    <div className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={reactionLabel}
        title={reactionLabel}
        className={`inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs transition xl:text-sm ${
          userReaction
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        {currentEmoji ? (
          <span className="text-xl">{currentEmoji}</span>
        ) : (
          <Heart size={18} className="shrink-0" />
        )}
        {countsTotal > 0 ? <span>{countsTotal}</span> : null}
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
                userReaction === r.type
                  ? "bg-primary/10 ring-1 ring-primary"
                  : ""
              }`}
              title={t(`reactions.${r.type}`)}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
