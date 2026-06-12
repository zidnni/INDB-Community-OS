import {Clock3} from "lucide-react";

export function TimelineHeader({title, subtitle}: {title: string; subtitle: string}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_14px_34px_rgba(8,33,56,0.08)] sm:p-5">
      <h1 className="inline-flex items-center gap-2 text-xl font-semibold">
        <Clock3 size={20} />
        {title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
