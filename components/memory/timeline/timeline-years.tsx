import {ChevronLeft} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Link} from "@/lib/i18n/routing";
import type {YearSummary} from "@/lib/data/memory-timeline";

export function TimelineYears({
  decade,
  years,
  memoryCountLabel,
  backLabel,
}: {
  decade: string;
  years: YearSummary[];
  memoryCountLabel: string;
  backLabel: string;
}) {
  return (
    <div className="space-y-4">
      <Link href="/memory/timeline">
        <Button variant="ghost" size="sm" className="gap-1">
          <ChevronLeft size={16} />
          {backLabel}
        </Button>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {years.map((y) => (
          <Link
            key={y.year}
            href={`/memory/timeline/year/${y.year}`}
            className="group rounded-xl border border-border/70 bg-card p-4 text-center shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.98]"
          >
            <span className="text-2xl font-bold tracking-tight">{y.year}</span>
            <p className="mt-1 text-xs text-muted-foreground">
              {y.memory_count} {memoryCountLabel}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
