import "server-only";

import crypto from "crypto";

import {createAdminClient} from "@/lib/supabase/admin";

export type RateLimitKind =
  | "search"
  | "translation"
  | "comment"
  | "reaction"
  | "follow"
  | "upload"
  | "fadla_message"
  | "login"
  | "register"
  | "passwordReset"
  | "resendVerification";

const RATE_LIMITS: Record<RateLimitKind, {limit: number; windowSeconds: number}> = {
  search: {limit: 60, windowSeconds: 60},
  translation: {limit: 30, windowSeconds: 60},
  comment: {limit: 20, windowSeconds: 60},
  reaction: {limit: 120, windowSeconds: 60},
  follow: {limit: 30, windowSeconds: 60},
  upload: {limit: 40, windowSeconds: 300},
  fadla_message: {limit: 15, windowSeconds: 60},
  login: {limit: 5, windowSeconds: 600},
  register: {limit: 3, windowSeconds: 1800},
  passwordReset: {limit: 3, windowSeconds: 3600},
  resendVerification: {limit: 3, windowSeconds: 1800},
};

const memoryBuckets = new Map<string, {count: number; resetAt: number}>();

function hashIdentifier(identifier: string) {
  return crypto.createHash("sha256").update(identifier).digest("hex");
}

function fallbackRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const existing = memoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, {count: 1, resetAt});
    return {allowed: true, remaining: limit - 1, retryAfter: 0};
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfter: 0,
  };
}

export function getRequestIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim() ?? "unknown-agent";
  return `${forwardedFor || realIp || "unknown-ip"}:${userAgent}`;
}

export async function checkRateLimit(
  kind: RateLimitKind,
  identifier: string,
): Promise<{allowed: boolean; remaining: number; retryAfter: number}> {
  const config = RATE_LIMITS[kind];
  const key = hashIdentifier(`${kind}:${identifier}`);
  const fallbackKey = `${kind}:${key}`;
  const admin = createAdminClient();

  if (!admin) {
    return fallbackRateLimit(fallbackKey, config.limit, config.windowSeconds);
  }

  try {
    const now = new Date();
    const newResetAt = new Date(now.getTime() + config.windowSeconds * 1000).toISOString();
    const {data} = await admin
      .from("rate_limits")
      .select("count, reset_at")
      .eq("key", key)
      .eq("bucket", kind)
      .maybeSingle();

    if (!data || new Date(data.reset_at).getTime() <= now.getTime()) {
      await admin.from("rate_limits").upsert({
        key,
        bucket: kind,
        count: 1,
        reset_at: newResetAt,
        updated_at: now.toISOString(),
      });
      return {allowed: true, remaining: config.limit - 1, retryAfter: 0};
    }

    if (data.count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((new Date(data.reset_at).getTime() - now.getTime()) / 1000)),
      };
    }

    const nextCount = data.count + 1;
    await admin
      .from("rate_limits")
      .update({count: nextCount, updated_at: now.toISOString()})
      .eq("key", key)
      .eq("bucket", kind);

    return {allowed: true, remaining: Math.max(0, config.limit - nextCount), retryAfter: 0};
  } catch {
    return fallbackRateLimit(fallbackKey, config.limit, config.windowSeconds);
  }
}
