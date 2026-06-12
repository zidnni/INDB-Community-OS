import {Skeleton} from "@/components/ui/skeleton";

export default function YearLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({length: 6}).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-3">
            <Skeleton className="h-52 w-full rounded-xl" />
            <Skeleton className="mt-3 h-4 w-24" />
            <Skeleton className="mt-2 h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-3 h-7 w-2/3 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
