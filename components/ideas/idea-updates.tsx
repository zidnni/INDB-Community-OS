"use client";

import {Loader2, Plus, SendHorizonal} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useState, useTransition} from "react";
import {toast} from "sonner";

import {OnlineAvatar} from "@/components/presence";

function timeAgo(dateStr: string, locale: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return locale === "ar" ? "الآن" : "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

export function IdeaUpdates({
  ideaId,
  updates: initialUpdates,
  isOwner,
  currentUserId,
}: {
  ideaId: string;
  updates: any[];
  isOwner: boolean;
  currentUserId: string | null;
}) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const [updates, setUpdates] = useState(initialUpdates);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  async function handlePublish() {
    const trimmed = input.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      try {
        const {createClient} = await import("@/lib/supabase/client");
        const supabase = createClient();

        const {data, error} = await supabase.rpc("get_idea_updates", {p_idea_id: ideaId});

        // For now, just insert directly via the API
        const {error: insertError} = await supabase.from("idea_updates").insert({
          idea_id: ideaId,
          author_id: currentUserId,
          content: trimmed,
        });

        if (insertError) {
          toast.error(t("updateFailed"));
          return;
        }

        // Re-fetch updates
        const {data: fresh} = await supabase
          .from("idea_updates")
          .select("*, author:author_id(id, username, full_name, avatar_url)")
          .eq("idea_id", ideaId)
          .order("created_at", {ascending: false});

        setUpdates(fresh ?? []);
        setInput("");
        toast.success(t("updatePublished"));
      } catch {
        toast.error(t("updateFailed"));
      }
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("updates")}</h3>

      {isOwner ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("updatePlaceholder")}
            className="h-9 flex-1 rounded-lg border border-border/60 bg-card px-3 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring"
          />
          <button
            type="button"
            onClick={handlePublish}
            disabled={pending || !input.trim()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={14} />}
          </button>
        </div>
      ) : null}

      {updates.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noUpdatesYet")}</p>
      ) : (
        <div className="space-y-2">
          {updates.map((update: any) => (
            <div
              key={update.id}
              className="flex gap-2.5 rounded-lg border border-border/40 bg-muted/30 p-3"
            >
              <OnlineAvatar
                userId={update.author_id}
                label={update.author_name ?? ""}
                avatarUrl={update.author_avatar_url}
                className="mt-0.5 h-6 w-6 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">
                    {update.author_name ?? update.author_username ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(update.created_at, locale)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground/90 leading-relaxed">
                  {update.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
