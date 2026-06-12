"use client";

import type {ImageUploadKind} from "@/lib/images/upload-config";
import {getMediaType, getMimeType} from "@/lib/images/upload-config";
import {prepareImageForUpload} from "@/lib/images/client-compression";
import {createClient} from "@/lib/supabase/client";
import {isVideoFile} from "@/lib/images/upload-config";

export interface UploadedMediaResult {
  url: string;
  storagePath: string;
  type: "image" | "video";
  mimeType: string;
}

export async function uploadFileToStorage(
  file: File,
  bucket: string,
  pathPrefix: string,
): Promise<UploadedMediaResult> {
  const supabase = createClient();
  const rateLimitResponse = await fetch("/api/uploads/rate-limit", {method: "POST"});

  if (!rateLimitResponse.ok) {
    throw new Error("Upload rate limit exceeded");
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${pathPrefix}/${Date.now()}-${safeFileName}`;

  const {error: uploadError} = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {cacheControl: "3600", upsert: false});

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {data: publicUrlData} = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    url: publicUrlData.publicUrl,
    storagePath: filePath,
    type: getMediaType(file),
    mimeType: getMimeType(file),
  };
}

export async function uploadMediaItem(
  file: File,
  uploadKind: ImageUploadKind,
): Promise<UploadedMediaResult> {
  const bucketMap: Record<string, string> = {
    post: "post-media",
    memory: "memory-archive",
    idea: "idea-media",
    fadla: "fadla-media",
  };

  const prefixMap: Record<string, string> = {
    post: "posts",
    memory: "memories",
    idea: "ideas",
    fadla: "fadla",
  };

  const bucket = bucketMap[uploadKind] ?? "post-media";
  const prefix = prefixMap[uploadKind] ?? "posts";
  const supabase = createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  const mediaType = getMediaType(file);
  const mediaFolder = mediaType === "video" ? "videos" : "images";
  const pathPrefix = `${user.id}/${prefix}/${mediaFolder}`;

  if (isVideoFile(file)) {
    return uploadFileToStorage(file, bucket, pathPrefix);
  }

  const compressed = await prepareImageForUpload(file, uploadKind);
  return uploadFileToStorage(compressed, bucket, pathPrefix);
}
