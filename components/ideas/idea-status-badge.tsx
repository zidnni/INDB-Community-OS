"use client";

import {useTranslations} from "next-intl";

import {Badge} from "@/components/ui/badge";
import type {IdeaStatus} from "@/types/database";

const palette: Record<IdeaStatus, string> = {
  submitted: "border-primary/20 bg-primary/10 text-primary",
  under_review: "border-accent/35 bg-accent/20 text-primary",
  accepted: "border-primary/30 bg-primary/15 text-primary",
  in_progress: "border-accent/30 bg-accent/20 text-accent-foreground dark:text-accent-foreground",
  completed: "border-accent/30 bg-accent/20 text-accent-foreground dark:text-accent-foreground",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
};

const keys: Record<IdeaStatus, string> = {
  submitted: "submitted",
  under_review: "underReview",
  accepted: "accepted",
  in_progress: "inProgress",
  completed: "completed",
  rejected: "rejected",
};

export function IdeaStatusBadge({status}: {status: IdeaStatus}) {
  const t = useTranslations("Ideas.status");
  const key = keys[status] ?? "submitted";

  return <Badge className={palette[status] ?? palette.submitted}>{t(key)}</Badge>;
}
