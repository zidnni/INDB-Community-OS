import * as React from "react";

import {cn} from "@/lib/utils/cn";

function Card({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/95 shadow-[0_8px_24px_rgba(12,31,44,0.07)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({className, ...props}: React.ComponentProps<"div">) {
  return <div className={cn("p-4 pb-0 sm:p-5 sm:pb-0", className)} {...props} />;
}

function CardTitle({className, ...props}: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}

function CardContent({className, ...props}: React.ComponentProps<"div">) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

function CardFooter({className, ...props}: React.ComponentProps<"div">) {
  return <div className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

export {Card, CardHeader, CardTitle, CardContent, CardFooter};


