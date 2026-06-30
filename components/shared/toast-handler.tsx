"use client";

import {useEffect, useRef} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

const SUCCESS_KEYS = [
  "updated",
  "postCreated",
  "commentAdded",
  "commentDeleted",
  "voteAdded",
  "postDeleted",
  "postSaved",
  "linkCopied",
  "emailSent",
  "emailConfirmation",
] as const;

export function ToastHandler() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(new Set<string>());
  const t = useTranslations("Toasts");

  useEffect(() => {
    let shouldCleanUrl = false;
    const nextParams = new URLSearchParams(searchParams.toString());

    const error = searchParams.get("error");
    if (error && !handled.current.has(`error:${error}`)) {
      handled.current.add(`error:${error}`);
      toast.error(decodeURIComponent(error));
      shouldCleanUrl = true;
    }
    if (error) nextParams.delete("error");

    const success = searchParams.get("success");
    if (success && !handled.current.has(`success:${success}`)) {
      handled.current.add(`success:${success}`);
      toast.success(decodeURIComponent(success));
      shouldCleanUrl = true;
    }
    if (success) nextParams.delete("success");

    for (const key of SUCCESS_KEYS) {
      if (searchParams.get(key) === "1" && !handled.current.has(key)) {
        handled.current.add(key);
        toast.success(t(key));
        shouldCleanUrl = true;
      }
      if (searchParams.has(key)) nextParams.delete(key);
    }

    if (shouldCleanUrl) {
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {scroll: false});
    }
  }, [pathname, router, searchParams, t]);

  return null;
}
