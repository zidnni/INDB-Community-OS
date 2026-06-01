import {Skeleton} from "@/components/ui/skeleton";

export default function IdeasLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-10/12" />
      </div>
      {Array.from({length: 4}).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-11/12" />
          <Skeleton className="mt-4 h-11 w-32" />
        </div>
      ))}
    </div>
  );
}
