import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "flex h-10 w-full min-w-0 rounded-[var(--radius-md)] bg-card text-foreground",
        "border-[1.5px] border-input px-3.5 py-2 text-sm shadow-xs",
        "placeholder:text-muted-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Motion
        "transition-[border-color,box-shadow,background-color] duration-150 ease-[var(--ease-out-quart)]",
        // Focus
        "outline-none focus-visible:border-primary focus-visible:shadow-[var(--shadow-glow-primary)]",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Invalid (error)
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_4px_rgba(239,68,68,.18)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
