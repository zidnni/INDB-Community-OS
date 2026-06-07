"use client";

import {CheckCircle2, Film, ImagePlus, Loader2, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useCallback, useRef, useState} from "react";
import {toast} from "sonner";

import {uploadMediaItem} from "@/lib/images/client-upload";
import {ImageUploadError} from "@/lib/images/client-compression";
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_VIDEO_EXTENSIONS,
  MEDIA_LIMITS,
  isVideoFile,
  validateVideoFile,
} from "@/lib/images/upload-config";

export interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  storagePath: string;
  mimeType?: string;
  uploading?: boolean;
  failed?: boolean;
}

export interface ExistingMediaItem {
  storagePath: string;
  url: string;
  type: "image" | "video";
}

interface MediaUploadProps {
  existingMedia?: ExistingMediaItem[];
  onMediaChange: (items: MediaItem[], removedStoragePaths: string[]) => void;
  uploadKind: "post" | "memory" | "idea";
}

export function MediaUpload({existingMedia, onMediaChange, uploadKind}: MediaUploadProps) {
  const t = useTranslations("ImageUpload");
  const [newItems, setNewItems] = useState<MediaItem[]>([]);
  const [removedExisting, setRemovedExisting] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const hasVideo = newItems.some((f) => f.type === "video") || (existingMedia ?? []).some(
    (f) => f.type === "video" && !removedExisting.includes(f.storagePath),
  );
  const hasImage = newItems.some((f) => f.type === "image") || (existingMedia ?? []).some(
    (f) => f.type === "image" && !removedExisting.includes(f.storagePath),
  );

  const getImageCount = useCallback(() => {
    const newImages = newItems.filter((f) => f.type === "image" && !f.failed).length;
    const existingImages = (existingMedia ?? []).filter(
      (f) => f.type === "image" && !removedExisting.includes(f.storagePath),
    ).length;
    return newImages + existingImages;
  }, [newItems, existingMedia, removedExisting]);

  function notifyChange(items: MediaItem[]) {
    onMediaChange(items, removedExisting);
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remainingSlots = MEDIA_LIMITS.maxImages - getImageCount();
    if (files.length > remainingSlots) {
      toast.error(t("tooLarge"));
      e.target.value = "";
      return;
    }

    setUploading(true);

    const placeholders: MediaItem[] = files.map((file) => ({
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: "image" as const,
      url: "",
      storagePath: "",
      uploading: true,
    }));

    setNewItems((prev) => [...prev, ...placeholders]);
    notifyChange([...newItems, ...placeholders]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const placeholderId = placeholders[i].id;

      try {
        const result = await uploadMediaItem(file, uploadKind);

        setNewItems((prev) =>
          prev.map((item) =>
            item.id === placeholderId
              ? {...item, url: result.url, storagePath: result.storagePath, mimeType: result.mimeType, uploading: false}
              : item,
          ),
        );
      } catch (error) {
        const msg = error instanceof ImageUploadError ? t(error.code) : t("failed");
        toast.error(msg);

        setNewItems((prev) =>
          prev.map((item) =>
            item.id === placeholderId ? {...item, uploading: false, failed: true} : item,
          ),
        );
      }
    }

    setUploading(false);
    e.target.value = "";
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isVideoFile(file)) {
      toast.error(t("invalidType"));
      e.target.value = "";
      return;
    }

    const validationError = validateVideoFile(file);
    if (validationError) {
      toast.error(t(validationError));
      e.target.value = "";
      return;
    }

    const placeholder: MediaItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: "video",
      url: "",
      storagePath: "",
      uploading: true,
    };

    const filtered = newItems.filter((f) => f.type !== "video");
    setNewItems([...filtered, placeholder]);
    notifyChange([...filtered, placeholder]);

    try {
      const result = await uploadMediaItem(file, uploadKind);

      setNewItems((prev) =>
        prev.map((item) =>
          item.id === placeholder.id
            ? {...item, url: result.url, storagePath: result.storagePath, mimeType: result.mimeType, uploading: false}
            : item,
        ),
      );
    } catch {
      toast.error(t("failed"));

      setNewItems((prev) =>
        prev.map((item) =>
          item.id === placeholder.id ? {...item, uploading: false, failed: true} : item,
        ),
      );
    }

    e.target.value = "";
  }

  function removeNewItem(id: string) {
    const updated = newItems.filter((f) => f.id !== id);
    setNewItems(updated);
    notifyChange(updated);
  }

  function removeExisting(storagePath: string) {
    setRemovedExisting((prev) => [...prev, storagePath]);
    onMediaChange(newItems, [...removedExisting, storagePath]);
  }

  const visibleExisting = (existingMedia ?? []).filter((e) => !removedExisting.includes(e.storagePath));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
          <ImagePlus size={18} />
          {t("chooseImage")}
          <input
            ref={imageInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_EXTENSIONS}
            multiple
            className="hidden"
            disabled={uploading || hasVideo}
            onChange={(e) => void handleImageSelect(e)}
          />
        </label>

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
          <Film size={18} />
          {t("chooseVideo")}
          <input
            ref={videoInputRef}
            type="file"
            accept={ACCEPTED_VIDEO_EXTENSIONS}
            className="hidden"
            disabled={uploading || hasImage || newItems.some((f) => f.type === "video")}
            onChange={(e) => void handleVideoSelect(e)}
          />
        </label>

        {uploading ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            {t("uploading")}
          </span>
        ) : null}
      </div>

      {visibleExisting.length > 0 || newItems.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visibleExisting.map((item) => (
            <div key={item.storagePath} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {item.type === "video" ? (
                <video src={item.url} className="h-full w-full object-cover" />
              ) : (
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeExisting(item.storagePath)}
                className="absolute end-1.5 top-1.5 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition hover:bg-background group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {newItems.map((item) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {item.uploading ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t("uploading")}</span>
                </div>
              ) : item.failed ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-destructive/10">
                  <X size={20} className="text-destructive" />
                  <span className="text-xs text-destructive">{t("failed")}</span>
                </div>
              ) : item.type === "video" ? (
                <video src={item.url} className="h-full w-full object-cover" />
              ) : (
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
              {!item.uploading && !item.failed ? (
                <div className="absolute end-1.5 top-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => removeNewItem(item.id)}
                    className="rounded-full bg-background/80 p-1 text-foreground transition hover:bg-background"
                  >
                    <X size={12} />
                  </button>
                  <CheckCircle2 size={14} className="text-green-500" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
