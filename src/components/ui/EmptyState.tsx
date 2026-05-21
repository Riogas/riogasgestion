import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon component (or any React component that accepts className). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Title — concise, e.g. "Sin pedidos hoy". */
  title: string;
  /** Optional explanatory subtitle. */
  description?: string;
  /** Optional CTA (Button) — render directly, e.g. <Button>Crear pedido</Button>. */
  action?: ReactNode;
  /** Visual size. 'sm' for inline-table empties, 'default' for full sections. */
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * Friendly empty state for tables, sections, and search results.
 * Replaces "No hay datos" placeholder text with a consistent pattern:
 * tinted icon + title + optional description + optional action.
 *
 * Usage:
 *   {filtered.length === 0 && (
 *     <EmptyState
 *       icon={Package}
 *       title="Sin pedidos en este rango"
 *       description="Ajustá los filtros o probá otra fecha."
 *       action={<Button variant="outline" onClick={clearAll}>Limpiar filtros</Button>}
 *     />
 *   )}
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "py-8 gap-2",
    default: "py-14 gap-3",
    lg: "py-20 gap-4",
  };
  const iconSize = {
    sm: "h-8 w-8",
    default: "h-12 w-12",
    lg: "h-16 w-16",
  };
  const iconWrapper = {
    sm: "h-12 w-12",
    default: "h-16 w-16",
    lg: "h-20 w-20",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6",
        sizeClasses[size],
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground",
            iconWrapper[size],
          )}
        >
          <Icon className={cn("opacity-60", iconSize[size])} />
        </div>
      )}
      <div className="space-y-1">
        <h3 className={cn(
          "font-semibold text-foreground",
          size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base",
        )}>
          {title}
        </h3>
        {description && (
          <p className={cn(
            "text-muted-foreground max-w-md mx-auto leading-relaxed",
            size === "sm" ? "text-xs" : "text-sm",
          )}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
