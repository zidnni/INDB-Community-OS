import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";

import {cn} from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-100 select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:opacity-90",
        ghost: "hover:bg-muted hover:text-foreground active:bg-muted/80",
        outline:
          "border border-border bg-card hover:bg-muted hover:text-foreground active:bg-muted/70",
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:shadow-md hover:opacity-90",
        destructive:
          "bg-destructive text-white shadow-sm hover:shadow-md hover:opacity-90",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-10 px-4 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant, size, ...props}, ref) => {
    return (
      <button
        className={cn(buttonVariants({variant, size, className}))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export {Button, buttonVariants};
