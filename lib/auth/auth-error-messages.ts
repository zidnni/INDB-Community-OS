import "server-only";

const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "auth_invalid_credentials",
  "Email not confirmed": "auth_email_not_confirmed",
  "Invalid email": "auth_invalid_email",
  "User already registered": "auth_user_exists",
  "Signup requires a valid password": "auth_weak_password",
  "Password should be at least 8 characters": "auth_weak_password",
  "Unable to validate email address: invalid format": "auth_invalid_email",
  "Email link is invalid or has expired": "auth_link_expired",
  "Rate limit exceeded": "auth_rate_limited",
  "Too many requests": "auth_rate_limited",
  "Email not found": "auth_generic_error",
  "User not found": "auth_generic_error",
  "Invalid code": "auth_generic_error",
  "Code has expired": "auth_link_expired",
  "Invalid code has been used": "auth_link_expired",
  "Code was already used": "auth_link_expired",
  "Bad code": "auth_generic_error",
  "Invalid verification code": "auth_generic_error",
  "new email cannot be the same as the old email": "auth_generic_error",
  "Only anon, email, or phone sign-ups are supported": "auth_generic_error",
};

function normalizeSupabaseMessage(message: string): string {
  return message.trim();
}

function getAuthErrorKey(error: { message?: string; code?: string }): string {
  if (!error) return "auth_generic_error";

  if (error.message) {
    const normalized = normalizeSupabaseMessage(error.message);
    if (AUTH_ERROR_MAP[normalized]) return AUTH_ERROR_MAP[normalized];

    const lowerMsg = normalized.toLowerCase();
    if (lowerMsg.includes("rate limit")) return "auth_rate_limited";
    if (lowerMsg.includes("email not confirmed") || lowerMsg.includes("email not verified"))
      return "auth_email_not_confirmed";
    if (
      lowerMsg.includes("invalid login") ||
      lowerMsg.includes("invalid credentials") ||
      lowerMsg.includes("wrong password")
    )
      return "auth_invalid_credentials";
    if (lowerMsg.includes("already registered")) return "auth_user_exists";
    if (lowerMsg.includes("weak password") || lowerMsg.includes("at least 8"))
      return "auth_weak_password";
    if (
      lowerMsg.includes("email link") &&
      (lowerMsg.includes("invalid") || lowerMsg.includes("expired"))
    )
      return "auth_link_expired";
    if (lowerMsg.includes("user not found") || lowerMsg.includes("email not found"))
      return "auth_generic_error";
    if (lowerMsg.includes("network") || lowerMsg.includes("fetch")) return "auth_network_error";
    if (lowerMsg.includes("session") || lowerMsg.includes("not authenticated"))
      return "auth_session_expired";
  }

  return "auth_generic_error";
}

export function getLocalizedAuthError(
  error: { message?: string; code?: string } | null,
  t: (key: string) => string,
): string {
  if (!error) return t("auth_generic_error");
  const key = getAuthErrorKey(error);
  return t(key);
}
