'use server';

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

import {routing} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {type ImageUploadKind, validateImageFile} from "@/lib/images/upload-config";
import {createClient} from "@/lib/supabase/server";
import {assertFeatureEnabledForMutation} from "@/core/features/server";
import {publishPlatformEvent} from "@/core/events/platform-events";

async function guardFeatureAction(featureId: Parameters<typeof assertFeatureEnabledForMutation>[0]) {
  try {
    await assertFeatureEnabledForMutation(featureId);
    return null;
  } catch {
    return "module_disabled";
  }
}

function normalizeLocale(value: FormDataEntryValue | null) {
  const locale = typeof value === "string" ? value : routing.defaultLocale;
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
}

async function uploadFile(
  file: File,
  bucket: string,
  userId: string,
  pathPrefix?: string,
): Promise<{url: string | null; storagePath: string | null}> {
  const supabase = await createClient();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const prefix = pathPrefix ?? "memories";
  const filePath = `${userId}/${prefix}/${Date.now()}-${safeFileName}`;

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadFile] starting upload", {
      bucket,
      filePath,
      fileSize: file.size,
      fileType: file.type,
      fileName: file.name,
    });
  }

  const {error: uploadError} = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {cacheControl: "3600", upsert: false});

  if (uploadError) {
    if (process.env.NODE_ENV === "development") {
      console.log("[uploadFile] upload failed", {
        error: uploadError.message,
        statusCode: uploadError.statusCode,
      });
    }
    return {url: null, storagePath: null};
  }

  const {data: publicUrlData} = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadFile] upload success", {publicUrl: publicUrlData.publicUrl});
  }

  return {url: publicUrlData.publicUrl, storagePath: filePath};
}

export async function recordSupportContributionAction(formData: FormData) {
  const disabled = await guardFeatureAction("campaigns");
  if (disabled) {
    const locale = normalizeLocale(formData.get("locale"));
    redirect(withLocale("/", locale));
  }

  const locale = normalizeLocale(formData.get("locale"));
  const campaignId = formData.get("campaignId");
  const campaignSlug = formData.get("campaignSlug");
  const contributionType = formData.get("contributionType");
  const returnPath = formData.get("returnPath");
  const amount = formData.get("amount");
  const customAmount = formData.get("customAmount");
  const paymentMethod = formData.get("paymentMethod");
  const transactionId = formData.get("transactionId");
  const receiptFile = formData.get("receipt");
  const message = formData.get("message");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) {
    redirect(withLocale("/login", locale));
  }

  if (
    typeof campaignId !== "string" ||
    typeof campaignSlug !== "string" ||
    !["money", "volunteer", "materials"].includes(String(contributionType))
  ) {
    redirect(withLocale("/campaigns", locale));
  }

  const parsedCustomAmount = typeof customAmount === "string" && customAmount.trim()
    ? Number(customAmount)
    : null;
  const parsedAmount = parsedCustomAmount && parsedCustomAmount > 0
    ? parsedCustomAmount
    : typeof amount === "string"
      ? Number(amount)
      : null;

  const safeContributionType = contributionType as "money" | "volunteer" | "materials";
  const safePaymentMethod = typeof paymentMethod === "string" && ["bankily", "masrivi", "sedad", "card"].includes(paymentMethod)
    ? paymentMethod as "bankily" | "masrivi" | "sedad" | "card"
    : null;

  if (safeContributionType === "money") {
    if (!parsedAmount || parsedAmount <= 0 || !safePaymentMethod) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=invalid-payment`, locale));
    }

    if (safePaymentMethod === "card") {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=cards-coming-soon`, locale));
    }

    const {getSupportPaymentReceivers} = await import("@/modules/campaigns/data/donations");
    const selectedReceiver = getSupportPaymentReceivers().find((receiver) => receiver.method === safePaymentMethod);
    if (!selectedReceiver?.configured) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=payment-not-ready`, locale));
    }

    if (typeof transactionId !== "string" || transactionId.trim().length < 3) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=transaction-required`, locale));
    }
  }

  let receiptUrl: string | null = null;
  let receiptStoragePath: string | null = null;
  if (
    safeContributionType === "money" &&
    receiptFile instanceof File &&
    receiptFile.size > 0 &&
    receiptFile.name
  ) {
    const validationError = validateImageFile(receiptFile, "post");
    if (validationError) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=receipt-invalid`, locale));
    }

    const uploaded = await uploadFile(receiptFile, "support-receipts", user.id, "receipts");
    receiptUrl = uploaded.url;
    receiptStoragePath = uploaded.storagePath;
    if (!receiptStoragePath) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=receipt-upload-failed`, locale));
    }
  }

  const {recordSupportContribution} = await import("@/lib/data/support");
  await recordSupportContribution({
    campaignId,
    userId: user.id,
    contributionType: safeContributionType,
    amount: safeContributionType === "money" && parsedAmount && parsedAmount > 0 ? parsedAmount : null,
    paymentMethod: safeContributionType === "money" ? safePaymentMethod : null,
    transactionId: safeContributionType === "money" && typeof transactionId === "string" ? transactionId.trim().slice(0, 120) : null,
    receiptUrl,
    receiptStoragePath,
    materialDescription: safeContributionType === "materials" && typeof message === "string" ? message.trim().slice(0, 500) : null,
    volunteerMessage: safeContributionType === "volunteer" && typeof message === "string" ? message.trim().slice(0, 500) : null,
  });

  if (safeContributionType === "money") {
    await publishPlatformEvent({
      name: "donation.created",
      actorId: user.id,
      entityType: "support_contribution",
      entityId: campaignId,
      metadata: {campaignId, contributionType: "money"},
    });
  } else if (safeContributionType === "volunteer") {
    await publishPlatformEvent({
      name: "volunteer.joined",
      actorId: user.id,
      entityType: "support_contribution",
      entityId: campaignId,
      metadata: {campaignId, contributionType: "volunteer"},
    });
  }

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignSlug}`);
  if (typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")) {
    revalidatePath(returnPath);
    redirect(withLocale(`${returnPath}?status=contribution-sent`, locale));
  }
  redirect(withLocale(`/campaigns/${campaignSlug}?status=contribution-sent`, locale));
}

export async function adminSetSupportContributionStatusAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));

  const disabled = await guardFeatureAction("campaigns");
  if (disabled) {
    redirect(withLocale("/", locale));
  }

  const contributionId = formData.get("contributionId");
  const nextStatus = formData.get("nextStatus");
  const rejectedReason = formData.get("rejectedReason");
  const returnPath = formData.get("returnPath");
  const statusPrefix = formData.get("statusPrefix");

  const {getCurrentAdminProfile} = await import("@/lib/data/admin");
  const adminProfile = await getCurrentAdminProfile();
  if (
    !adminProfile ||
    typeof contributionId !== "string" ||
    !["verified", "rejected", "refunded"].includes(String(nextStatus))
  ) {
    redirect(withLocale("/", locale));
  }

  const {adminSetSupportContributionStatus} = await import("@/lib/data/support");
  await adminSetSupportContributionStatus({
    contributionId,
    adminId: adminProfile.id,
    status: nextStatus as "verified" | "rejected" | "refunded",
    rejectedReason: typeof rejectedReason === "string" ? rejectedReason.trim().slice(0, 500) : null,
  });

  if (nextStatus === "verified") {
    const {createNotification} = await import("@/lib/data/notifications");
    const supabase = await createClient();
    const {data: contribution} = await supabase
      .from("support_contributions")
      .select("contributor_id, amount, contribution_type, campaign:support_campaigns(title)")
      .eq("id", contributionId)
      .single();
    if (contribution?.contributor_id) {
      const campaignTitle = Array.isArray(contribution.campaign)
        ? contribution.campaign[0]?.title
        : (contribution.campaign as {title?: string} | null)?.title;
      const amount =
        contribution.amount && typeof contribution.amount === "number"
          ? `${contribution.amount.toLocaleString()} MRU`
          : "";
      await createNotification({
        userId: contribution.contributor_id,
        actorId: adminProfile.id,
        type: "donation_verified",
        entityType: "support_contribution",
        entityId: contributionId,
        title: "تم تأكيد تبرعك ✅",
        message: campaignTitle
          ? `تبرعك بمبلغ ${amount} لحملة "${campaignTitle}" تم تأكيده. شكراً لمساهمتك ❤️`
          : `تبرعك بمبلغ ${amount} تم تأكيده. شكراً لمساهمتك ❤️`,
        metadata: {status: "verified", amount: contribution.amount, campaignTitle},
      });
    }
    await publishPlatformEvent({
      name: "donation.verified",
      actorId: adminProfile.id,
      entityType: "support_contribution",
      entityId: contributionId,
      metadata: {contributionId, verifiedBy: adminProfile.id},
    });
  }

  revalidatePath("/campaigns");
  revalidatePath("/admin/support");
  revalidatePath("/admin/volunteer");
  if (
    typeof returnPath === "string" &&
    returnPath.startsWith("/admin/volunteer") &&
    !returnPath.startsWith("//")
  ) {
    const prefix = statusPrefix === "volunteer" ? "volunteer" : "donation";
    redirect(withLocale(`${returnPath}?status=${prefix}-${nextStatus}`, locale));
  }
  redirect(withLocale(`/admin/support?status=donation-${nextStatus}`, locale));
}

export async function adminUpdateSupportCampaignAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));

  const disabled = await guardFeatureAction("campaigns");
  if (disabled) {
    redirect(withLocale("/", locale));
  }

  const campaignId = formData.get("campaignId");
  const raisedAmount = Number(formData.get("raisedAmount") ?? 0);
  const contributorsCount = Number(formData.get("contributorsCount") ?? 0);
  const volunteersCount = Number(formData.get("volunteersCount") ?? 0);
  const campaignStatus = formData.get("campaignStatus");
  const finalReport = formData.get("finalReport");

  const {getCurrentAdminProfile} = await import("@/lib/data/admin");
  const adminProfile = await getCurrentAdminProfile();
  if (!adminProfile || typeof campaignId !== "string") {
    redirect(withLocale("/", locale));
  }

  const status = ["upcoming", "active", "paused", "completed", "archived"].includes(String(campaignStatus))
    ? campaignStatus as "upcoming" | "active" | "paused" | "completed" | "archived"
    : "active";
  const {adminUpdateSupportCampaign} = await import("@/lib/data/support");
  await adminUpdateSupportCampaign({
    campaignId,
    raisedAmount: Number.isFinite(raisedAmount) ? Math.max(0, raisedAmount) : 0,
    contributorsCount: Number.isFinite(contributorsCount) ? Math.max(0, contributorsCount) : 0,
    volunteersCount: Number.isFinite(volunteersCount) ? Math.max(0, volunteersCount) : 0,
    status,
    finalReport: typeof finalReport === "string" && finalReport.trim() ? finalReport.trim().slice(0, 2000) : null,
  });

  revalidatePath("/campaigns");
  revalidatePath("/admin/support");
  redirect(withLocale("/admin/support?status=saved", locale));
}

export async function adminCreateSupportCampaignAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));

  const disabled = await guardFeatureAction("campaigns");
  if (disabled) {
    redirect(withLocale("/", locale));
  }

  const slug = formData.get("slug");
  const emoji = formData.get("emoji");
  const title = formData.get("title");
  const description = formData.get("description");
  const longDescription = formData.get("longDescription");
  const goalAmount = Number(formData.get("goalAmount") ?? 0);
  const endsAt = formData.get("endsAt");
  const campaignStatus = formData.get("campaignStatus");

  const {getCurrentAdminProfile} = await import("@/lib/data/admin");
  const adminProfile = await getCurrentAdminProfile();
  if (
    !adminProfile ||
    typeof slug !== "string" ||
    typeof emoji !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof longDescription !== "string" ||
    typeof endsAt !== "string"
  ) {
    redirect(withLocale("/", locale));
  }

  const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (!safeSlug || !title.trim() || !description.trim() || !Number.isFinite(goalAmount) || goalAmount <= 0) {
    redirect(withLocale("/admin/support?status=invalid", locale));
  }

  const status = ["upcoming", "active", "paused", "completed", "archived"].includes(String(campaignStatus))
    ? campaignStatus as "upcoming" | "active" | "paused" | "completed" | "archived"
    : "active";

  const {adminCreateSupportCampaign} = await import("@/lib/data/support");
  const campaignId = await adminCreateSupportCampaign({
    slug: safeSlug,
    emoji: emoji.trim().slice(0, 8) || "🤝",
    title: title.trim().slice(0, 120),
    description: description.trim().slice(0, 220),
    longDescription: longDescription.trim().slice(0, 1000),
    goalAmount,
    endsAt,
    status,
  });

  if (!campaignId) {
    redirect(withLocale("/admin/support?status=create-failed", locale));
  }

  revalidatePath("/campaigns");
  revalidatePath("/admin/support");
  redirect(withLocale("/admin/support?status=created", locale));
}

export async function adminCreateSupportUpdateAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));

  const disabled = await guardFeatureAction("campaigns");
  if (disabled) {
    redirect(withLocale("/", locale));
  }

  const campaignId = formData.get("campaignId");
  const title = formData.get("title");
  const body = formData.get("body");

  const {getCurrentAdminProfile} = await import("@/lib/data/admin");
  const adminProfile = await getCurrentAdminProfile();
  if (!adminProfile || typeof campaignId !== "string" || typeof title !== "string" || typeof body !== "string") {
    redirect(withLocale("/", locale));
  }

  const {adminCreateSupportUpdate} = await import("@/lib/data/support");
  await adminCreateSupportUpdate({
    campaignId,
    title: title.trim().slice(0, 120),
    body: body.trim().slice(0, 1000),
  });

  revalidatePath("/campaigns");
  revalidatePath("/admin/support");
  redirect(withLocale("/admin/support?status=update-published", locale));
}

export async function adminSetDonationStatusAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));

  const disabled = await guardFeatureAction("campaigns");
  if (disabled) {
    redirect(withLocale("/", locale));
  }

  const contributionId = formData.get("contributionId");
  const nextStatus = formData.get("nextStatus");

  const {getCurrentAdminProfile} = await import("@/lib/data/admin");
  const adminProfile = await getCurrentAdminProfile();
  if (
    !adminProfile ||
    typeof contributionId !== "string" ||
    !["verified", "rejected", "refunded"].includes(String(nextStatus))
  ) {
    redirect(withLocale("/", locale));
  }

  const {adminSetSupportContributionStatus} = await import("@/lib/data/support");
  await adminSetSupportContributionStatus({
    contributionId,
    adminId: adminProfile.id,
    status: nextStatus as "verified" | "rejected" | "refunded",
    rejectedReason: null,
  });

  revalidatePath("/admin/donations");
  redirect(withLocale(`/admin/donations?status=donation-${nextStatus}`, locale));
}
