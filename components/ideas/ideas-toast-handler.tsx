"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function IdeasToastHandler({
  ideaSubmitted,
  ideaUpdated,
  ideaDeleted,
}: {
  ideaSubmitted: boolean;
  ideaUpdated: boolean;
  ideaDeleted: boolean;
}) {
  const t = useTranslations("Ideas");
  const ideaFormT = useTranslations("IdeaForm");

  useEffect(() => {
    if (ideaSubmitted) {
      toast.success(ideaFormT("successMessage"));
    }
  }, [ideaSubmitted, ideaFormT]);

  useEffect(() => {
    if (ideaUpdated) {
      toast.success(t("ideaUpdated"));
    }
  }, [ideaUpdated, t]);

  useEffect(() => {
    if (ideaDeleted) {
      toast.success(t("ideaDeleted"));
    }
  }, [ideaDeleted, t]);

  return null;
}
