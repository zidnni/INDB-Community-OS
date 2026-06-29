"use client";

import {Loader2, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useState} from "react";

import {OnlineAvatar} from "@/components/presence";
import {Link} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/client";

export function SupporterListModal({
  ideaId,
  open,
  onClose,
  totalCount,
}: {
  ideaId: string;
  open: boolean;
  onClose: () => void;
  totalCount: number;
}) {
  const t = useTranslations("Ideas");
  const [supporters, setSupporters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setSupporters([]); return; }
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("idea_supporters")
      .select("user_id, created_at, profile:profiles!idea_supporters_user_id_fkey(id, username, full_name, avatar_url)")
      .eq("idea_id", ideaId)
      .order("created_at", {ascending: false})
      .then(({data}) => {
        setSupporters(data ?? []);
        setLoading(false);
      });
  }, [ideaId, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-background sm:max-h-[70vh] sm:w-[480px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-semibold">
            {t("supportersWithCount", {count: totalCount})}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : supporters.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("noSupportersYet")}</p>
          ) : (
            <div className="space-y-2">
              {supporters.map((s) => (
                <Link
                  key={s.user_id}
                  href={`/profile/${s.profile?.username ?? s.user_id}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted"
                >
                  <OnlineAvatar
                    userId={s.user_id}
                    label={s.profile?.full_name ?? s.profile?.username ?? ""}
                    avatarUrl={s.profile?.avatar_url}
                    className="h-8 w-8"
                  />
                  <span className="text-sm font-medium">
                    {s.profile?.full_name ?? s.profile?.username ?? "Unknown"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
