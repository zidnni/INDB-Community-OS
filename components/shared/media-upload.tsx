"use client";

import {Film, ImagePlus, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useCallback, useRef, useState} from "react";
import {toast} from "sonner";

import {prepareImageForUpload, ImageUploadError} from "@/lib/images/client-compression";
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_VIDEO_EXTENSIONS,
  MEDIA_LIMITS,
  isImageFile,
  isVideoFile,
  validateVideoFile,
} from "@/lib/images/upload-config";

export interface MediaItem {
  id: string;
  file: File;
  preview: string;
  type: "image" | "video";
  uploading?: boolean;
}

export interface ExistingMediaItem {
  storagePath: string;
  url: string;
  type: "image" | "video";
}

interface MediaUploadProps {
  existingMedia?: ExistingMediaItem[];
  onMediaChange: (files: MediaItem[], removedStoragePaths: string[]) => void;
  uploadKind: "post" | "memory" | "idea";
}

export function MediaUpload({existingMedia, onMediaChange, uploadKind}: MediaUploadProps) {
  const t = useTranslations("ImageUpload");
  const [newFiles, setNewFiles] = useState<MediaItem[]>([]);
  const [removedExisting, setRemovedExisting] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const totalCount = newFiles.length + (existingMedia?.length ?? 0) - removedExisting.length;
  const hasVideo = newFiles.some((f) => f.type === "video") || (existingMedia ?? []).some((f) => f.type === "video" && !removedExisting.includes(f.storagePath));
  const hasImage = newFiles.some((f) => f.type === "image") || (existingMedia ?? []).some((f) => f.type === "image" && !removedExisting.includes(f.storagePath));

  const getImageCount = useCallback(() => {
    const newImages = newFiles.filter((f) => f.type === "image").length;
    const existingImages = (existingMedia ?? []).filter((f) => f.type === "image" && !removedExisting.includes(f.storagePath)).length;
    return newImages + existingImages;
  }, [newFiles, existingMedia, removedExisting]);

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
    const processed: MediaItem[] = [];

    for (const file of files) {
      try {
        const prepared = await prepareImageForUpload(file, uploadKind);
        processed.push({
          id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file: prepared,
          preview: URL.createObjectURL(prepared),
          type: "image",
        });
      } catch (error) {
        if (error instanceof ImageUploadError) {
          toast.error(t(error.code));
        } else {
          toast.error(t("failed"));
        }
      }
    }

    setNewFiles((prev) => [...prev, ...processed]);
    setUploading(false);
    e.target.value = "";

    // Store files in a data attribute for the form
    notifyChange([...newFiles, ...processed]);
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
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

    const item: MediaItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      type: "video",
    };

    // Replace any existing video in new files
    const filtered = newFiles.filter((f) => f.type !== "video");
    setNewFiles([...filtered, item]);
    notifyChange([...filtered, item]);
    e.target.value = "";
  }

  function removeNewFile(id: string) {
    const item = newFiles.find((f) => f.id === id);
    if (item) {
      URL.revokeObjectURL(item.preview);
    }
    const updated = newFiles.filter((f) => f.id !== id);
    setNewFiles(updated);
    notifyChange(updated);
  }

  function removeExisting(storagePath: string) {
    setRemovedExisting((prev) => [...prev, storagePath]);
    // Notify parent with current state
    const stillExisting = (existingMedia ?? []).filter((e) => !removedExisting.includes(e.storagePath) && e.storagePath !== storagePath);
    onMediaChange(newFiles, [...removedExisting, storagePath]);
  }

  function notifyChange(files: MediaItem[]) {
    onMediaChange(files, removedExisting);
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
            disabled={uploading || hasImage || newFiles.some((f) => f.type === "video")}
            onChange={(e) => void handleVideoSelect(e)}
          />
        </label>

        {uploading ? <span className="flex items-center text-sm text-muted-foreground">{t("uploading")}</span> : null}
      </div>

      {/* Existing media preview */}
      {visibleExisting.length > 0 || newFiles.length > 0 ? (
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

          {newFiles.map((item) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {item.type === "video" ? (
                <video src={item.preview} className="h-full w-full object-cover" />
              ) : (
                <img src={item.preview} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeNewFile(item.id)}
                className="absolute end-1.5 top-1.5 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition hover:bg-background group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
