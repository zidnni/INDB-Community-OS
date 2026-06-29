"use client";

import {Camera, Loader2, Trash2, Upload} from "lucide-react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {toast} from "sonner";

import {createClient} from "@/lib/supabase/client";
import type {ProgressImageStage} from "@/types/database";

const STAGE_LABELS: Record<ProgressImageStage, string> = {
  before: "stageBefore",
  progress: "stageProgress",
  final: "stageFinal",
};

const STAGE_COLORS: Record<ProgressImageStage, string> = {
  before: "border-blue-400/30 bg-blue-50/50 dark:bg-blue-950/10",
  progress: "border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/10",
  final: "border-emerald-400/30 bg-emerald-50/50 dark:bg-emerald-950/10",
};

const STAGE_ICON_COLORS: Record<ProgressImageStage, string> = {
  before: "text-blue-500",
  progress: "text-amber-500",
  final: "text-emerald-500",
};

export function IdeaMediaGallery({
  ideaId,
  images: initialImages,
  isOwner,
}: {
  ideaId: string;
  images: any[];
  isOwner: boolean;
}) {
  const t = useTranslations("Ideas");
  const [images, setImages] = useState<any[]>(initialImages);
  const [uploading, setUploading] = useState<ProgressImageStage | null>(null);

  async function handleUpload(stage: ProgressImageStage) {
    if (!isOwner) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(stage);
      try {
        const supabase = createClient();
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return;

        const ext = file.name.split(".").pop() ?? "jpg";
        const filePath = `idea-progress/${ideaId}/${stage}_${Date.now()}.${ext}`;

        const {error: uploadError} = await supabase.storage
          .from("idea-progress")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {data: {publicUrl}} = supabase.storage
          .from("idea-progress")
          .getPublicUrl(filePath);

        const {data, error} = await supabase
          .from("idea_progress_images")
          .insert({idea_id: ideaId, stage, url: publicUrl, storage_path: filePath})
          .select()
          .single();

        if (error) throw error;
        if (data) setImages((prev) => [...prev, data]);
        toast.success(t("imageUploaded"));
      } catch {
        toast.error(t("uploadFailed"));
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  async function handleDelete(imageId: string) {
    if (!isOwner) return;
    const image = images.find((img) => img.id === imageId);
    if (!image) return;

    try {
      const supabase = createClient();
      if (image.storage_path) {
        await supabase.storage.from("idea-progress").remove([image.storage_path]);
      }
      await supabase.from("idea_progress_images").delete().eq("id", imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      toast.success(t("imageDeleted"));
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  const grouped = {before: [] as any[], progress: [] as any[], final: [] as any[]};
  for (const img of images) {
    if (grouped[img.stage as ProgressImageStage]) {
      grouped[img.stage as ProgressImageStage].push(img);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera size={18} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("projectGallery")}</h3>
      </div>

      {(["before", "progress", "final"] as ProgressImageStage[]).map((stage) => {
        const stageImages = grouped[stage];
        return (
          <div key={stage} className={`rounded-xl border p-3 ${STAGE_COLORS[stage]}`}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Camera size={14} className={STAGE_ICON_COLORS[stage]} />
                <span className="text-xs font-medium text-muted-foreground">
                  {t(STAGE_LABELS[stage])}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  ({stageImages.length})
                </span>
              </div>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => handleUpload(stage)}
                  disabled={uploading === stage}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-background/80"
                >
                  {uploading === stage ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {t("upload")}
                </button>
              ) : null}
            </div>

            {stageImages.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t("noImagesYet")}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {stageImages.map((img) => (
                  <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={img.url}
                      alt={img.caption ?? ""}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 33vw, 25vw"
                    />
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(img.id)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
