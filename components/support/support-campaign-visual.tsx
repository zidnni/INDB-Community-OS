import {cn} from "@/lib/utils/cn";

interface SupportCampaignVisualProps {
  emoji: string;
  title: string;
  tone: string;
  accent: string;
  className?: string;
}

export function SupportCampaignVisual({emoji, title, tone, accent, className}: SupportCampaignVisualProps) {
  return (
    <div
      aria-label={title}
      className={cn(
        "relative isolate min-h-44 overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-inner",
        tone,
        accent,
        className,
      )}
      role="img"
    >
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0_2px,transparent_2px),linear-gradient(135deg,white_0_1px,transparent_1px)] [background-size:28px_28px,18px_18px]" />
      <div className="absolute -end-12 -top-12 h-40 w-40 rounded-full bg-white/25" />
      <div className="absolute -bottom-16 start-8 h-44 w-44 rounded-full bg-black/10" />
      <div className="relative flex h-full min-h-44 flex-col justify-between p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-sm backdrop-blur">
          {emoji}
        </span>
        <div>
          <p className="text-sm font-bold text-white/80">I ❤️ NDB</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{title}</h3>
        </div>
      </div>
    </div>
  );
}
