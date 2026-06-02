"use client";

import {useEffect, useRef} from "react";
import {useSearchParams} from "next/navigation";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

const SUCCESS_KEYS = [
  "updated",
  "postCreated",
  "commentAdded",
  "commentDeleted",
  "ideaSubmitted",
  "memorySubmitted",
  "voteAdded",
  "postDeleted",
  "postSaved",
  "linkCopied",
  "emailSent",
] as const;

export function ToastHandler() {
  const searchParams = useSearchParams();
  const handled = useRef(new Set<string>());
  const t = useTranslations("Toasts");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && !handled.current.has(`error:${error}`)) {
      handled.current.add(`error:${error}`);
      toast.error(decodeURIComponent(error));
    }

    for (const key of SUCCESS_KEYS) {
      if (searchParams.get(key) === "1" && !handled.current.has(key)) {
        handled.current.add(key);
        toast.success(t(key));
      }
    }
  }, [searchParams, t]);

  return null;
}
