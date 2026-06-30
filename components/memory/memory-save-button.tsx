"use client";

import {Bookmark} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {saveMemoryAction, unsaveMemoryAction} from "@/app/[locale]/server-actions";
import {createClient} from "@/lib/supabase/client";
import {cn} from "@/lib/utils/cn";

export function MemorySaveButton({memoryId}: {memoryId: string}) {
  const t = useTranslations("Feed");
  const supabase = useRef(createClient()).current;
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {data: {user}} = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const {data} = await supabase
        .from("saved_memories")
        .select("id")
        .eq("memory_id", memoryId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setSaved(!!data);
        setLoading(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [memoryId, supabase]);

  async function handleToggle() {
    if (pending || loading) return;
    const nextSaved = !saved;
    setPending(true);
    setSaved(nextSaved);

    const formData = new FormData();
    formData.set("memoryId", memoryId);

    if (!nextSaved) {
      const result = await unsaveMemoryAction(formData);
      if (!result.success) {
        setSaved(!nextSaved);
        toast.error(t("shareFailed") ?? "Failed to unsave");
      }
    } else {
      const result = await saveMemoryAction(formData);
      if (!result.success) {
        setSaved(!nextSaved);
        if (result.error === "unauthorized") {
          const locale = document.documentElement.lang || "en";
          window.location.href = `/${locale}/login`;
          return;
        }
        toast.error(t("shareFailed") ?? "Failed to save");
      }
    }

    setPending(false);
  }

  if (loading) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm transition",
        saved
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Bookmark size={16} className={saved ? "fill-primary" : ""} />
      {saved ? t("saved") : t("save")}
    </button>
  );
}
