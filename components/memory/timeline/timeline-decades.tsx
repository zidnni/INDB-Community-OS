import {Link} from "@/lib/i18n/routing";
import type {DecadeSummary} from "@/lib/data/memory-timeline";

export function TimelineDecades({
  decades,
  memoryCountLabel,
}: {
  decades: DecadeSummary[];
  memoryCountLabel: string;
}) {
  if (decades.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {decades.map((d) => (
        <Link
          key={d.decade}
          href={`/memory/timeline/${d.decade}`}
          className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.98]"
        >
          <h3 className="text-xl font-bold tracking-tight">{d.decade}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.memory_count} {memoryCountLabel}
          </p>
        </Link>
      ))}
    </div>
  );
}
