import {Skeleton} from "@/components/ui/skeleton";

export default function EventsLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-10/12" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({length: 4}).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-3">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-4 h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
