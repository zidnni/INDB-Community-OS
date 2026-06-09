import {Archive, Lightbulb, Newspaper, Search, UserRound} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {UserAvatar} from "@/components/layout/user-avatar";
import {EmptyState} from "@/components/shared/empty-state";
import {Link} from "@/lib/i18n/routing";
import {countSearchResults, globalSearch, type SearchResultItem, type SearchResultType} from "@/lib/data/search";

const resultIcons: Record<SearchResultType, typeof Newspaper> = {
  post: Newspaper,
  idea: Lightbulb,
  memory: Archive,
  profile: UserRound,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Search"});

  return {
    title: t("title"),
  };
}

function ResultCard({
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
        <UserAvatar
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

function ResultSection({
  title,
  typeLabel,
  results,
}: {
  title: string;
  typeLabel: string;
  results: SearchResultItem[];
}) {
  if (results.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="grid gap-3">
        {results.map((result) => (
          <ResultCard key={`${result.type}-${result.id}`} result={result} typeLabel={typeLabel} />
        ))}
      </div>
    </section>
  );
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{q?: string}>;
}) {
  const {locale} = await params;
  const {q = ""} = await searchParams;
  const t = await getTranslations({locale, namespace: "Search"});
  const query = q.trim();
  const results = query.length >= 2 ? await globalSearch(query, locale, {limit: 20}) : null;
  const total = results ? countSearchResults(results) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2">
          <Search size={20} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            {query ? (
              <p className="text-sm text-muted-foreground">{t("resultsFor", {query})}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
            )}
          </div>
        </div>
      </div>

      {!query || query.length < 2 ? (
        <EmptyState
          icon={Search}
          title={t("title")}
          description={t("minLength")}
          ctaLabel={t("placeholder")}
          ctaHref="/search"
        />
      ) : total === 0 || !results ? (
        <EmptyState
          icon={Search}
          title={t("noResults")}
          description={t("noResults")}
          ctaLabel={t("placeholder")}
          ctaHref="/search"
        />
      ) : (
        <div className="space-y-6">
          <ResultSection
            title={t("sections.posts")}
            typeLabel={t("types.post")}
            results={results.posts}
          />
          <ResultSection
            title={t("sections.ideas")}
            typeLabel={t("types.idea")}
            results={results.ideas}
          />
          <ResultSection
            title={t("sections.memories")}
            typeLabel={t("types.memory")}
            results={results.memories}
          />
          <ResultSection
            title={t("sections.people")}
            typeLabel={t("types.profile")}
            results={results.profiles}
          />
        </div>
      )}
    </div>
  );
}
