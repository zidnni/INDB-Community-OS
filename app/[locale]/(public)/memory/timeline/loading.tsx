import {Skeleton} from "@/components/ui/skeleton";

export default function MemoryTimelineLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-2 h-4 w-10/12" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({length: 6}).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-5">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
