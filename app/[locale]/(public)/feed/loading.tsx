import {Skeleton} from "@/components/ui/skeleton";

function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-10/12" />
        <Skeleton className="h-3 w-8/12" />
      </div>
      <Skeleton className="mt-4 h-56 w-full rounded-2xl" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

export default function FeedLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="mb-4 flex gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}
