import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — modern interactive button (active press, focus ring, disabled)
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
    "transition-[transform,box-shadow,background-color,color,opacity] duration-150 ease-[var(--ease-out-quart)] " +
    "active:translate-y-px " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 " +
    "outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "aria-invalid:ring-2 aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Brand primary (Azul Riogas)
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        // Brand accent (Naranja llama) — high-emphasis CTA
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90",
        // Tonal secondary
        secondary:
          "bg-muted text-foreground border border-border shadow-xs hover:bg-muted/70",
        // Outline (1.5px brand-aware)
        outline:
          "border-[1.5px] border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        // Quiet (no chrome by default)
        ghost:
          "bg-transparent text-foreground hover:bg-muted",
        // Danger
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/50",
        // Inline link
        link: "text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-8 px-3 text-sm has-[>svg]:px-2.5",
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        lg: "h-12 px-6 text-base has-[>svg]:px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
