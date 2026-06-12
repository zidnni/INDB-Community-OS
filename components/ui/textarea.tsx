import * as React from "react";

import {cn} from "@/lib/utils/cn";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({className, ...props}, ref) => {
  return (
    <textarea
      className={cn(
        "min-h-20 max-h-48 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm max-sm:min-h-[56px] max-sm:text-base outline-none placeholder:text-muted-foreground transition-all duration-150 focus:border-[#ED2124] focus:shadow-[0_0_0_3px_rgba(237,33,36,0.12)] overflow-y-auto resize-y",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export {Textarea};
