import {Skeleton} from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <Skeleton className="h-44 w-full rounded-none" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 w-24 rounded-2xl" />
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <Skeleton className="h-6 w-36" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
