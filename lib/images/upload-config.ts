export type ImageUploadKind = "avatar" | "cover" | "post" | "memory" | "idea";

export type ImageValidationError = "invalidType" | "tooLarge";

export const ACCEPTED_IMAGE_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
export const ACCEPTED_VIDEO_EXTENSIONS = ".mp4,.webm,.mov";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
const ALLOWED_VIDEO_EXTENSIONS_LIST = ["mp4", "webm", "mov"] as const;

export const IMAGE_UPLOAD_CONFIG: Record<
  ImageUploadKind,
  {
    maxOriginalBytes: number;
    targetMaxBytes: number;
    compressionMaxSizeMB: number;
    maxWidthOrHeight: number;
  }
> = {
  avatar: {
    maxOriginalBytes: 5 * 1024 * 1024,
    targetMaxBytes: 1 * 1024 * 1024,
    compressionMaxSizeMB: 1,
    maxWidthOrHeight: 1024,
  },
  cover: {
    maxOriginalBytes: 10 * 1024 * 1024,
    targetMaxBytes: 2 * 1024 * 1024,
    compressionMaxSizeMB: 2,
    maxWidthOrHeight: 1920,
  },
  post: {
    maxOriginalBytes: 10 * 1024 * 1024,
    targetMaxBytes: 2 * 1024 * 1024,
    compressionMaxSizeMB: 2,
    maxWidthOrHeight: 1920,
  },
  memory: {
    maxOriginalBytes: 15 * 1024 * 1024,
    targetMaxBytes: 3 * 1024 * 1024,
    compressionMaxSizeMB: 3,
    maxWidthOrHeight: 2400,
  },
  idea: {
    maxOriginalBytes: 10 * 1024 * 1024,
    targetMaxBytes: 2 * 1024 * 1024,
    compressionMaxSizeMB: 2,
    maxWidthOrHeight: 1920,
  },
};

export const VIDEO_UPLOAD_CONFIG = {
  maxOriginalBytes: 50 * 1024 * 1024,
};

export const MEDIA_LIMITS = {
  maxImages: 6,
  maxVideos: 1,
  imageSizeMB: 10,
  videoSizeMB: 50,
};

export function validateImageFile(file: File, kind: ImageUploadKind): ImageValidationError | null {
  if (!isAllowedImageFile(file)) {
    return "invalidType";
  }

  if (file.size > IMAGE_UPLOAD_CONFIG[kind].maxOriginalBytes) {
    return "tooLarge";
  }

  return null;
}

export function validateCompressedImageFile(file: File, kind: ImageUploadKind): ImageValidationError | null {
  if (!isAllowedImageFile(file)) {
    return "invalidType";
  }

  if (file.size > IMAGE_UPLOAD_CONFIG[kind].targetMaxBytes) {
    return "tooLarge";
  }

  return null;
}

export function validateVideoFile(file: File): ImageValidationError | null {
  if (!isAllowedVideoFile(file)) {
    return "invalidType";
  }

  if (file.size > VIDEO_UPLOAD_CONFIG.maxOriginalBytes) {
    return "tooLarge";
  }

  return null;
}

export function isVideoFile(file: File): boolean {
  return isAllowedVideoFile(file);
}

export function isImageFile(file: File): boolean {
  return isAllowedImageFile(file);
}

function isAllowedImageFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  return (
    ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]) ||
    ALLOWED_IMAGE_EXTENSIONS.includes(extension as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])
  );
}

function isAllowedVideoFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  return (
    ALLOWED_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_TYPES)[number]) ||
    ALLOWED_VIDEO_EXTENSIONS_LIST.includes(extension as (typeof ALLOWED_VIDEO_EXTENSIONS_LIST)[number])
  );
}

export function getMediaType(file: File): "image" | "video" {
  return isVideoFile(file) ? "video" : "image";
}

export function getMimeType(file: File): string {
  return file.type || (isVideoFile(file) ? "video/mp4" : "image/jpeg");
}
