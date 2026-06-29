"use client";

import {Handshake, Loader2, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {toast} from "sonner";

import {requestParticipateAction} from "@/app/[locale]/server-actions";
import {useRouter} from "@/lib/i18n/routing";

const CONTRIBUTION_TYPES = [
  "volunteer_time",
  "professional_skills",
  "equipment",
  "transportation",
  "organization",
  "other",
] as const;

export function ParticipantJoinModal({
  ideaId,
  open,
  onClose,
}: {
  ideaId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Ideas");
  const router = useRouter();
  const [contributionType, setContributionType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    if (!contributionType) {
      toast.error(t("selectContributionType"));
      return;
    }
    setPending(true);
    const formData = new FormData();
    formData.set("ideaId", ideaId);
    formData.set("message", description || `I want to contribute: ${t(`contribution_${contributionType}`)}`);

    const result = await requestParticipateAction(formData);
    setPending(false);

    if (!result.success) {
      if (result.error === "unauthorized") {
        router.push(`/login?next=${encodeURIComponent(`/ideas/${ideaId}`)}`);
        return;
      }
      if (result.error === "already_requested") {
        toast.error(t("alreadyRequested"));
      } else {
        toast.error(t("participationError"));
      }
      return;
    }
    toast.success(t("participationRequested"));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-background sm:w-[440px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Handshake size={18} className="text-primary" />
            <h3 className="text-sm font-semibold">{t("joinAsParticipant")}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">{t("howWouldYouContribute")}</p>

          <div className="grid grid-cols-2 gap-2">
            {CONTRIBUTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setContributionType(type)}
                className={`rounded-xl border p-3 text-left text-xs font-medium transition ${
                  contributionType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/30 hover:bg-muted"
                }`}
              >
                {t(`contribution_${type}`)}
              </button>
            ))}
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("contributionDetails")}
            rows={2}
            className="w-full resize-none rounded-xl border border-border/60 bg-card px-3 py-2 text-xs outline-none ring-primary/30 focus:ring"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !contributionType}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("sendRequest")}
          </button>
        </div>
      </div>
    </div>
  );
}
