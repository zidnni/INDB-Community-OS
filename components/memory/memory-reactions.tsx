"use client";

import {useEffect, useRef, useState} from "react";
import {Heart} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

import {reactToMemoryAction} from "@/app/[locale]/server-actions";
import type {MemoryReactionType} from "@/types/database";

const REACTIONS: {type: MemoryReactionType; emoji: string}[] = [
  {type: "like", emoji: "\u{1F44D}"},
  {type: "love", emoji: "\u2764\uFE0F"},
  {type: "support", emoji: "\u{1F91D}"},
  {type: "celebrate", emoji: "\u{1F389}"},
  {type: "insightful", emoji: "\u{1F4A1}"},
  {type: "sad", emoji: "\u{1F622}"},
];

export function MemoryReactions({
  memoryId,
  initialCounts,
  initialUserReaction,
  showLabels,
}: {
  memoryId: string;
  initialCounts?: Record<string, number>;
  initialUserReaction?: MemoryReactionType | null;
  showLabels?: boolean;
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

  const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const currentEmoji = REACTIONS.find((r) => r.type === userReaction)?.emoji;

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
        const locale = document.documentElement.lang || "en";
        window.location.href = `/${locale}/login`;
        setPending(false);
        return;
      }
      toast.error(errors("reactionFailed") ?? "Reaction failed");
    } else {
      if (result.reaction_counts) {
        setCounts(result.reaction_counts);
      }
      setUserReaction(result.reaction ?? null);
    }

    setPending(false);
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-sm transition sm:gap-2 sm:px-4 ${
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
        <span>{totalCount > 0 ? totalCount : (showLabels ? t("reactions.like") : "")}</span>
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
