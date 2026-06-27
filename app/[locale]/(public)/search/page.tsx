import {Search} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {SearchResultCard} from "@/components/search/search-result-card";
import {EmptyState} from "@/components/shared/empty-state";
import {countSearchResults, globalSearch, type SearchResultItem} from "@/lib/data/search";

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
          <SearchResultCard key={`${result.type}-${result.id}`} result={result} typeLabel={typeLabel} />
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
            title={t("sections.fadla")}
            typeLabel={t("types.fadla")}
            results={results.fadla}
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
