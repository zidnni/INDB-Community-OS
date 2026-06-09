"use client";

import {Archive, Lightbulb, Loader2, Newspaper, Search, UserRound, X} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useMemo, useRef, useState} from "react";

import {UserAvatar} from "@/components/layout/user-avatar";
import {Input} from "@/components/ui/input";
import {useRouter} from "@/lib/i18n/routing";
import type {GlobalSearchResults, SearchResultItem, SearchResultType} from "@/lib/data/search";

const resultIcons: Record<SearchResultType, typeof Newspaper> = {
  post: Newspaper,
  idea: Lightbulb,
  memory: Archive,
  profile: UserRound,
};

function flattenResults(results: GlobalSearchResults | null): SearchResultItem[] {
  if (!results) return [];
  return [
    ...results.posts,
    ...results.ideas,
    ...results.memories,
    ...results.profiles,
  ];
}

export function SearchBar() {
  const t = useTranslations("Search");
  const locale = useLocale();
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const trimmedQuery = query.trim();
  const flattenedResults = useMemo(() => flattenResults(results), [results]);
  const hasResults = flattenedResults.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults(null);
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}&locale=${locale}&limit=5`, {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Search failed");

        const payload = await response.json() as {results: GlobalSearchResults};
        setResults(payload.results);
        setOpen(true);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setError(true);
          setResults(null);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [locale, trimmedQuery]);

  function openFullSearch() {
    if (trimmedQuery.length < 2) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  }

  function openResult(result: SearchResultItem) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Search
        size={16}
        className="pointer-events-none absolute inset-y-0 start-3 my-auto text-muted-foreground"
      />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (trimmedQuery.length >= 2) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            openFullSearch();
          } else if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={t("placeholder")}
        className="h-10 rounded-full border-border/70 bg-card ps-9"
        aria-label={t("placeholder")}
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setResults(null);
            setOpen(false);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 end-3 my-auto flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={t("clear")}
        >
          <X size={14} />
        </button>
      ) : null}

      {open && trimmedQuery.length >= 2 ? (
        <div className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
          <div className="max-h-[min(70vh,440px)] overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                {t("searching")}
              </div>
            ) : error ? (
              <p className="px-4 py-4 text-sm text-destructive">{t("error")}</p>
            ) : hasResults ? (
              flattenedResults.map((result) => {
                const Icon = resultIcons[result.type];
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    type="button"
                    onClick={() => openResult(result)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-start transition hover:bg-muted/70"
                  >
                    {result.type === "profile" ? (
                      <UserAvatar
                        label={result.title}
                        avatarUrl={result.avatarUrl}
                        className="h-10 w-10 shrink-0 text-xs"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon size={18} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{result.title}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t(`types.${result.type}`)}
                        </span>
                      </span>
                      {result.snippet ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.snippet}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">{t("noResults")}</p>
            )}
          </div>

          <button
            type="button"
            onClick={openFullSearch}
            className="flex w-full items-center justify-center border-t border-border/60 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            {t("viewAll")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
