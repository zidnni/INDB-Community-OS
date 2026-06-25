"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";

async function logAudit(type: string, paymentId: string, actorId: string, details: string) {
  try {
    const supabase = await createClient();
    await supabase.from("notifications").insert({
      user_id: actorId,
      actor_id: actorId,
      type,
      entity_type: "payment",
      entity_id: paymentId,
      title: details,
      metadata: {actorName: null},
    });
  } catch {}
}

export async function verifyPayment(paymentId: string, note?: string) {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const {error} = await supabase
    .from("support_contributions")
    .update({
      payment_status: "verified",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      notes: note || null,
    })
    .eq("id", paymentId);

  if (error) throw new Error(error.message);
  await logAudit("payment_verify", paymentId, user.id, note || "Payment verified");
  revalidatePath("/admin/payments");
}

export async function rejectPayment(paymentId: string, note?: string) {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const {error} = await supabase
    .from("support_contributions")
    .update({
      payment_status: "rejected",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      notes: note || null,
    })
    .eq("id", paymentId);

  if (error) throw new Error(error.message);
  await logAudit("payment_reject", paymentId, user.id, note || "Payment rejected");
  revalidatePath("/admin/payments");
}

export async function refundPayment(paymentId: string, note?: string) {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const {error} = await supabase
    .from("support_contributions")
    .update({
      payment_status: "refunded",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      notes: note || null,
    })
    .eq("id", paymentId);

  if (error) throw new Error(error.message);
  await logAudit("payment_refund", paymentId, user.id, note || "Payment refunded");
  revalidatePath("/admin/payments");
}

export async function flagPayment(paymentId: string, note?: string) {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("support_contributions")
    .update({notes: note || "Flagged as suspicious"})
    .eq("id", paymentId);

  await logAudit("payment_flag", paymentId, user.id, note || "Payment flagged as suspicious");
  revalidatePath("/admin/payments");
}
