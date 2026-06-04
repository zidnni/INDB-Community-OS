"use client";

import {ChevronUp} from "lucide-react";
import {useEffect, useRef} from "react";
import type {ReactNode} from "react";

import {Avatar} from "@/components/ideas/avatar";

interface TopIdeaRowProps {
  idea: {
    id: string;
    rank: number | null;
    title: string;
    votes_count: number;
    supportPercentage: number;
    author: {
      avatar_url: string | null;
      full_name: string | null;
      username: string | null;
    } | null;
  };
  authorName: string;
  badgeEl: ReactNode;
}

export function TopIdeaRow({idea, authorName, badgeEl}: TopIdeaRowProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    function handler(e: Event) {
      e.preventDefault();
      e.stopPropagation();
      console.log("topIdeaClick", idea.id);
      const target = document.getElementById(`idea-${idea.id}`);
      if (target) {
        target.scrollIntoView({behavior: "smooth", block: "start"});
        window.history.replaceState(null, "", `#idea-${idea.id}`);
      }
    }

    btn.addEventListener("click", handler);
    return () => btn.removeEventListener("click", handler);
  }, [idea.id]);

  return (
    <button
      ref={ref}
      type="button"
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-start transition hover:bg-muted/50 active:scale-[0.98] active:bg-muted/70 sm:px-4 sm:py-3 touch-manipulation max-sm:min-w-[80vw] max-sm:snap-start"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0F4C75] to-[#27C5D8] text-sm font-bold text-white">
        {idea.rank}
      </span>

      <Avatar author={idea.author} />

      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate text-base font-medium">{idea.title}</span>
        <span className="text-sm text-muted-foreground truncate">{authorName}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <ChevronUp size={14} />
          {idea.votes_count}
        </span>
        <span className="tabular-nums hidden sm:inline">{idea.supportPercentage}%</span>
        {badgeEl}
      </div>
    </button>
  );
}
