"use client";

import {Check, Circle, Loader2, Plus, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {toast} from "sonner";

import {createClient} from "@/lib/supabase/client";

export function MilestoneList({
  ideaId,
  milestones: initialMilestones,
  isOwner,
}: {
  ideaId: string;
  milestones: any[];
  isOwner: boolean;
}) {
  const t = useTranslations("Ideas");
  const [milestones, setMilestones] = useState<any[]>(initialMilestones);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [pendingMilestone, setPendingMilestone] = useState<string | null>(null);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const supabase = createClient();
      const {data, error} = await supabase
        .from("idea_milestones")
        .insert({idea_id: ideaId, title, sort_order: milestones.length})
        .select()
        .single();
      if (error) throw error;
      setMilestones((prev) => [...prev, data]);
      setNewTitle("");
      toast.success(t("milestoneAdded"));
    } catch {
      toast.error(t("milestoneFailed"));
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(milestone: any) {
    setPendingMilestone(milestone.id);
    const newStatus = milestone.status === "completed" ? "pending" : "completed";
    try {
      const supabase = createClient();
      const {error} = await supabase
        .from("idea_milestones")
        .update({status: newStatus})
        .eq("id", milestone.id);
      if (error) throw error;
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestone.id ? {...m, status: newStatus} : m)),
      );
    } catch {
      toast.error(t("milestoneUpdateFailed"));
    } finally {
      setPendingMilestone(null);
    }
  }

  async function handleDelete(milestoneId: string) {
    try {
      const supabase = createClient();
      await supabase.from("idea_milestones").delete().eq("id", milestoneId);
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      toast.success(t("milestoneDeleted"));
    } catch {
      toast.error(t("milestoneDeleteFailed"));
    }
  }

  const progress = milestones.length > 0
    ? Math.round((milestones.filter((m) => m.status === "completed").length / milestones.length) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t("milestones")}</h3>
          {milestones.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              ({milestones.filter((m) => m.status === "completed").length}/{milestones.length})
            </span>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      {milestones.length > 0 ? (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{width: `${progress}%`}}
          />
        </div>
      ) : null}

      {/* List */}
      <div className="space-y-1.5">
        {milestones.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">{t("noMilestonesYet")}</p>
        ) : (
          milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5">
              <button
                type="button"
                onClick={() => isOwner && handleToggle(m)}
                disabled={!isOwner || pendingMilestone === m.id}
                className={`shrink-0 transition ${
                  !isOwner ? "cursor-default" : "hover:opacity-80"
                } ${pendingMilestone === m.id ? "opacity-50" : ""}`}
              >
                {m.status === "completed" ? (
                  <Check size={16} className="text-emerald-500" />
                ) : (
                  <Circle size={16} className="text-muted-foreground/40" />
                )}
              </button>
              <span
                className={`flex-1 text-xs ${
                  m.status === "completed"
                    ? "text-muted-foreground line-through"
                    : "text-foreground/90"
                }`}
              >
                {m.title}
              </span>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  className="shrink-0 text-muted-foreground/50 hover:text-destructive"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* Add milestone */}
      {isOwner ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder={t("addMilestone")}
            maxLength={200}
            className="h-8 flex-1 rounded-lg border border-border/60 bg-card px-2.5 text-xs outline-none ring-primary/30 focus:ring"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
