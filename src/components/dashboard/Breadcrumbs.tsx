"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Human-readable labels for dashboard URL segments. Add new routes here as
 * they're created. Falls back to a Title-Case version of the segment.
 */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Inicio",
  pedidos: "Pedidos",
  moviles: "Móviles",
  clientes: "Clientes",
  mapa: "Mapa",
  services: "Services",
  usuarios: "Usuarios",
  configuracion: "Configuración",
  "normalizar-calles": "Normalizar calles",
  "no-autorizado": "No autorizado",
};

function humanize(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

interface BreadcrumbsProps {
  className?: string;
  /** Hide the home icon at the start. Default false. */
  hideHome?: boolean;
}

export function Breadcrumbs({ className, hideHome }: BreadcrumbsProps) {
  const pathname = usePathname() ?? "";
  // Split, drop empty, drop leading `dashboard` segment (it's the root)
  const segments = pathname.split("/").filter(Boolean);
  const dashIdx = segments.indexOf("dashboard");
  const trail = dashIdx >= 0 ? segments.slice(dashIdx + 1) : segments;

  // Build href accumulator
  const items = trail.map((seg, i) => {
    const href = "/dashboard/" + trail.slice(0, i + 1).join("/");
    return { label: humanize(seg), href, isLast: i === trail.length - 1 };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "hidden md:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0",
        className,
      )}
    >
      {!hideHome && (
        <Link
          href="/dashboard"
          className="inline-flex items-center hover:text-foreground transition-colors"
          aria-label="Inicio"
        >
          <Home className="h-3.5 w-3.5" />
        </Link>
      )}
      {items.length === 0 && !hideHome && (
        <span className="text-foreground font-medium ml-1.5">Inicio</span>
      )}
      {items.map((item, i) => (
        <span key={item.href} className="inline-flex items-center gap-1.5 min-w-0">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
          {item.isLast ? (
            <span className="text-foreground font-medium truncate">
              {item.label}
            </span>
          ) : (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors truncate"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
