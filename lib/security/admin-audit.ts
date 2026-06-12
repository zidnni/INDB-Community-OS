import "server-only";

import {createAdminClient} from "@/lib/supabase/admin";

export async function recordAdminAuditLog({
  adminId,
  action,
  targetType,
  targetId,
  metadata = {},
}: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  if (!admin) return;

  const {error} = await admin.from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata,
  });

  if (error && process.env.NODE_ENV === "development") {
    console.error("recordAdminAuditLog failed", error);
  }
}
