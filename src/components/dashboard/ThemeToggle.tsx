"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/useTheme";

/**
 * 3-state theme toggle: light → dark → system → light.
 * Icon reflects the current mode (Sun / Moon / Monitor).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, cycleMode, mounted } = useTheme();

  const Icon =
    mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const label =
    mode === "light"
      ? "Tema claro · Click para cambiar a oscuro"
      : mode === "dark"
      ? "Tema oscuro · Click para cambiar a sistema"
      : "Tema del sistema · Click para cambiar a claro";

  // Avoid hydration mismatch: render a stable placeholder until mounted
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Tema" className={className}>
        <Sun className="h-4 w-4 opacity-0" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleMode}
          aria-label={label}
          className={className}
        >
          <Icon className="h-4 w-4 transition-transform duration-200 hover:rotate-12" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
