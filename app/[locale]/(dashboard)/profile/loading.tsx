import {Skeleton} from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Skeleton className="h-48 w-full rounded-2xl sm:h-56 md:h-64" />

      <div className="relative px-4 sm:px-0">
        <div className="flex flex-col items-center sm:flex-row sm:items-end sm:gap-6">
          <div className="-mt-16 sm:-mt-20 z-10 shrink-0">
            <Skeleton className="h-28 w-28 rounded-full sm:h-36 sm:w-36" />
          </div>
          <div className="mt-2 flex-1 space-y-2 text-center sm:mt-0 sm:text-left">
            <Skeleton className="mx-auto h-7 w-48 sm:mx-0" />
            <Skeleton className="mx-auto h-4 w-32 sm:mx-0" />
            <Skeleton className="mx-auto h-4 w-64 sm:mx-0" />
            <Skeleton className="mx-auto h-4 w-40 sm:mx-0" />
          </div>
          <div className="mt-3 sm:mt-0 sm:self-center">
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-0 rounded-2xl border border-border/70 bg-card">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1 py-3 text-center">
              <Skeleton className="mx-auto h-6 w-8" />
              <Skeleton className="mx-auto h-3 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-1 rounded-2xl border border-border/70 bg-card p-1">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 flex-1 rounded-xl" />
          ))}
        </div>

        <div className="mt-4 space-y-3 sm:space-y-4">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
