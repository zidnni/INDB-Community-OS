import {Skeleton} from "@/components/ui/skeleton";

export default function DecadeLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-2 h-4 w-8/12" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({length: 10}).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/70 bg-card p-4 text-center">
            <Skeleton className="mx-auto h-7 w-14" />
            <Skeleton className="mx-auto mt-2 h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
