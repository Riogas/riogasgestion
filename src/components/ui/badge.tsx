import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Base — tonal pill (tinted bg + solid fg). Modern alternative to filled badges.
  "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium " +
    "w-fit whitespace-nowrap shrink-0 border-0 " +
    "[&>svg]:size-3 [&>svg]:pointer-events-none [&>svg]:shrink-0 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 " +
    "aria-invalid:ring-2 aria-invalid:ring-destructive/40 " +
    "transition-colors duration-150 overflow-hidden",
  {
    variants: {
      variant: {
        // Brand-primary tonal
        default: "bg-primary/10 text-primary [a&]:hover:bg-primary/15",
        // Neutral
        secondary: "bg-muted text-foreground [a&]:hover:bg-muted/70",
        // Success
        success: "bg-success/10 text-success [a&]:hover:bg-success/15",
        // Warn
        warn: "bg-warn/10 text-warn [a&]:hover:bg-warn/15",
        // Danger
        destructive: "bg-destructive/10 text-destructive [a&]:hover:bg-destructive/15",
        // Info (cyan / chart-4)
        info: "bg-chart-4/10 text-chart-4 [a&]:hover:bg-chart-4/15",
        // Outline (preserved for back-compat)
        outline: "border border-border text-foreground [a&]:hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant ?? "default"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
