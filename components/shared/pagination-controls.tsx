import {ChevronLeft, ChevronRight} from "lucide-react";

import {Link} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";

function pageHref(page: number) {
  return page <= 1 ? "?" : `?page=${page}`;
}

export function PaginationControls({
  page,
  hasNextPage,
  previousLabel,
  nextLabel,
}: {
  page: number;
  hasNextPage: boolean;
  previousLabel: string;
  nextLabel: string;
}) {
  const hasPreviousPage = page > 1;

  if (!hasPreviousPage && !hasNextPage) return null;

  const previousClass = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold transition",
    hasPreviousPage ? "hover:bg-muted" : "pointer-events-none opacity-50",
  );
  const nextClass = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold transition",
    hasNextPage ? "hover:bg-muted" : "pointer-events-none opacity-50",
  );

  return (
    <nav className="flex items-center justify-center gap-3 py-2" aria-label="Pagination">
      <Link href={pageHref(page - 1)} aria-disabled={!hasPreviousPage} className={previousClass}>
        <ChevronLeft size={17} />
        {previousLabel}
      </Link>
      <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">{page}</span>
      <Link href={pageHref(page + 1)} aria-disabled={!hasNextPage} className={nextClass}>
        {nextLabel}
        <ChevronRight size={17} />
      </Link>
    </nav>
  );
}
