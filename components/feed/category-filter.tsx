"use client";

import {useTranslations} from "next-intl";

import {Link} from "@/lib/i18n/routing";

export function CategoryFilter({
  items,
  selected,
}: {
  items: Array<{slug: string; name: string}>;
  selected: string | null;
}) {
  const t = useTranslations("Feed");

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/feed"
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          !selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {t("all")}
      </Link>
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`/feed?category=${item.slug}` as never}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            selected === item.slug
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}

