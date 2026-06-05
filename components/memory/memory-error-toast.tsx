"use client";

import {useEffect} from "react";
import {toast} from "sonner";

export function MemoryErrorToast({error}: {error?: string}) {
  useEffect(() => {
    if (error) {
      toast.error(decodeURIComponent(error), {duration: 8000});
    }
  }, [error]);

  return null;
}
