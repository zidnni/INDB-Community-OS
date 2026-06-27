"use client";

import {Archive, Gift, Lightbulb, Newspaper, UserRound} from "lucide-react";

import {OnlineAvatar} from "@/components/presence/online-avatar";
import {Link} from "@/lib/i18n/routing";
import type {SearchResultItem, SearchResultType} from "@/lib/data/search";

const resultIcons: Record<SearchResultType, typeof Newspaper> = {
  post: Newspaper,
  idea: Lightbulb,
  memory: Archive,
  fadla: Gift,
  profile: UserRound,
};

export function SearchResultCard({
  result,
  typeLabel,
}: {
  result: SearchResultItem;
  typeLabel: string;
}) {
  const Icon = resultIcons[result.type];

  return (
    <Link
      href={result.href}
      className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-start shadow-[0_10px_28px_rgba(8,33,56,0.06)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_34px_rgba(8,33,56,0.10)]"
    >
      {result.type === "profile" ? (
        <OnlineAvatar
          userId={result.id}
          label={result.title}
          avatarUrl={result.avatarUrl}
          className="h-11 w-11 shrink-0 text-xs"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon size={19} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-base font-semibold text-foreground">{result.title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {typeLabel}
          </span>
        </span>
        {result.authorName && result.type !== "profile" ? (
          <span className="mt-1 block text-xs text-muted-foreground">{result.authorName}</span>
        ) : null}
        {result.snippet ? (
          <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">{result.snippet}</span>
        ) : null}
      </span>
    </Link>
  );
}
