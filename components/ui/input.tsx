import * as React from "react";

import {cn} from "@/lib/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({className, type = "text", ...props}, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm max-sm:h-12 max-sm:text-base outline-none placeholder:text-muted-foreground transition-all duration-150 focus:border-[#ED2124] focus:shadow-[0_0_0_3px_rgba(237,33,36,0.12)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export {Input};
