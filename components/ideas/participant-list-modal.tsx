"use client";

import {Loader2, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useState} from "react";

import {OnlineAvatar} from "@/components/presence";
import {Badge} from "@/components/ui/badge";
import {Link} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/client";

const CONTRIBUTION_COLORS: Record<string, string> = {
  volunteer_time: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  professional_skills: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  equipment: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  transportation: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  organization: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400",
};

export function ParticipantListModal({
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
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setParticipants([]); return; }
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("idea_participants")
      .select("id, contribution_type, contribution_description, created_at, user:profiles!idea_participants_user_id_fkey(id, username, full_name, avatar_url)")
      .eq("idea_id", ideaId)
      .eq("status", "accepted")
      .order("created_at", {ascending: false})
      .then(({data}) => {
        setParticipants(data ?? []);
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
            {t("participantsWithCount", {count: totalCount})}
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
          ) : participants.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("noParticipantsYet")}</p>
          ) : (
            <div className="space-y-2">
              {participants.map((p) => (
                <Link
                  key={p.id}
                  href={`/profile/${p.user?.username ?? p.user_id}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted"
                >
                  <OnlineAvatar
                    userId={p.user_id}
                    label={p.user?.full_name ?? p.user?.username ?? ""}
                    avatarUrl={p.user?.avatar_url}
                    className="h-8 w-8"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {p.user?.full_name ?? p.user?.username ?? "Unknown"}
                    </span>
                    {p.contribution_type ? (
                      <Badge className={`ml-2 text-[10px] font-medium ${CONTRIBUTION_COLORS[p.contribution_type] ?? CONTRIBUTION_COLORS.other}`}>
                        {t(`contribution_${p.contribution_type}`)}
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
