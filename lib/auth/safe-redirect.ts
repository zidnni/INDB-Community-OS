const ALLOWED_PROTOCOLS = ["http:", "https:"];

const INTERNAL_PATH_REGEX = /^\/(?:[a-z]{2}(?:\/[a-z]{2})?\/)?(?:[a-zA-Z0-9\-._~!$&'()*+,;=:@/%]*)?$/;

const BLOCKED_PATHS = [
  "//",
  "http://",
  "https://",
  "ftp://",
  "data:",
  "javascript:",
  "vbscript:",
  "file:",
];

export function sanitizeRedirectUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  const trimmed = url.trim();

  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) return null;

  for (const blocked of BLOCKED_PATHS) {
    if (trimmed.toLowerCase().startsWith(blocked)) return null;
  }

  if (!trimmed.startsWith("/")) return null;

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null;
    if (parsed.hostname !== "localhost") return null;
  } catch {
    return null;
  }

  if (!INTERNAL_PATH_REGEX.test(trimmed)) return null;

  return trimmed;
}
