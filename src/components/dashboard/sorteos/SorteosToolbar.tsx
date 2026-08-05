"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Toolbar de las tablas del módulo Sorteos.
 *
 * Orden clásico de lista: búsqueda y filtros a la IZQUIERDA (ocupan el espacio
 * disponible), metadatos y acción primaria a la DERECHA. Reemplaza a
 * `ListHeader` en este módulo, que apilaba todo contra el borde derecho y
 * dejaba media fila vacía con el buscador después del botón primario.
 */
export function SorteosToolbar({
  search,
  onSearch,
  searchPlaceholder = "Buscar…",
  searchLabel = "Buscar",
  filters,
  meta,
  actions,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Filtros que acompañan a la búsqueda (izquierda). */
  filters?: ReactNode;
  /** Indicadores informativos (derecha, antes de las acciones). */
  meta?: ReactNode;
  /** Acción primaria de la pantalla (extremo derecho). */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center animate-fade-in-up">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72 lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="pl-9"
          />
        </div>
        {filters}
      </div>
      {(meta || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:justify-end">
          {meta}
          {actions}
        </div>
      )}
    </div>
  );
}
