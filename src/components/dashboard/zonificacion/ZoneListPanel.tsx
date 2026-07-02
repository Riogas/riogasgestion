"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Clock,
  Copy,
  Layers,
  MapPinned,
  Moon,
  MoreVertical,
  Pencil,
  Plus,
  Spline,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  SERVICE_LABEL,
  ZONE_TYPE_LABEL,
  type ServiceType,
  type Zone,
} from "@/lib/types/zona";

const SERVICE_ICON: Record<ServiceType, typeof Zap> = {
  URGENTE: Zap,
  SERVICE: Clock,
  NOCTURNO: Moon,
};

function ZoneListItem({
  zone,
  selected,
  onSelect,
  onEditGeometry,
  onDuplicate,
  onArchiveToggle,
  onDelete,
}: {
  zone: Zone;
  selected: boolean;
  onSelect: () => void;
  onEditGeometry: () => void;
  onDuplicate: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const archived = zone.status === "ARCHIVED";

  return (
    // div clickeable (no <button>): adentro vive el trigger del menú, y
    // anidar <button> dentro de <button> es HTML inválido (error de hidratación).
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group w-full cursor-pointer rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/40 bg-primary/10 hover:bg-primary/10",
        archived && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="size-3 shrink-0 rounded-full ring-2 ring-background"
          style={{ backgroundColor: zone.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {zone.name}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Acciones de ${zone.name}`}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onClick={onSelect}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEditGeometry} disabled={archived}>
              <Spline className="size-4" />
              Editar polígono
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="size-4" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchiveToggle}>
              {archived ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
              {archived ? "Restaurar" : "Archivar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 pl-[22px]">
        <Badge
          variant="outline"
          className={cn(
            "px-1.5 py-0 text-[10px]",
            zone.zoneType === "DISTRIBUCION"
              ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
              : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
          )}
        >
          {ZONE_TYPE_LABEL[zone.zoneType]}
        </Badge>
        {archived && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            Archivada
          </Badge>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
          {zone.services.map((s) => {
            const Icon = SERVICE_ICON[s];
            return (
              <Icon key={s} className="size-3.5" aria-label={SERVICE_LABEL[s]} />
            );
          })}
        </span>
      </div>
    </div>
  );
}

interface ZoneListPanelProps {
  zones: Zone[];
  isLoading: boolean;
  selectedId: number | null;
  showArchived: boolean;
  onToggleArchived: () => void;
  onSelect: (id: number) => void;
  onEditGeometry: (id: number) => void;
  onDuplicate: (id: number) => void;
  onArchiveToggle: (zone: Zone) => void;
  onDelete: (zone: Zone) => void;
  onNewZone: () => void;
}

// Carga incremental: arranca mostrando ~7 y agrega de a PAGE al scrollear.
const LIST_PAGE = 20;

export function ZoneListPanel({
  zones,
  isLoading,
  selectedId,
  showArchived,
  onToggleArchived,
  onSelect,
  onEditGeometry,
  onDuplicate,
  onArchiveToggle,
  onDelete,
  onNewZone,
}: ZoneListPanelProps) {
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE);

  // Reset del paginado cuando cambia el conjunto (filtros/puesto).
  useEffect(() => {
    setVisibleCount(LIST_PAGE);
  }, [zones.length]);

  const visible = zones.slice(0, visibleCount);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (
      visibleCount < zones.length &&
      el.scrollTop + el.clientHeight >= el.scrollHeight - 120
    ) {
      setVisibleCount((c) => Math.min(c + LIST_PAGE, zones.length));
    }
  };

  return (
    <Card className="gap-3 overflow-hidden px-0 py-4">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-sm font-semibold text-foreground">
          Zonas ({zones.length})
        </h2>
        <Layers className="size-4 text-muted-foreground" />
      </div>

      {/* ~7 filas visibles; el resto entra con scroll (carga incremental). */}
      <div
        onScroll={handleScroll}
        className="flex max-h-[440px] min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2"
      >
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-3">
              <div className="size-3 animate-pulse rounded-full bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </div>
          ))}

        {!isLoading && zones.length === 0 && (
          <EmptyState
            icon={MapPinned}
            size="sm"
            title="No hay zonas creadas para este puesto."
            description="Creá una nueva zona dibujándola en el mapa."
            action={
              <Button size="sm" onClick={onNewZone}>
                <Plus className="size-4" />
                Crear zona
              </Button>
            }
          />
        )}

        {!isLoading &&
          visible.map((z) => (
            <ZoneListItem
              key={z.id}
              zone={z}
              selected={selectedId === z.id}
              onSelect={() => onSelect(z.id)}
              onEditGeometry={() => onEditGeometry(z.id)}
              onDuplicate={() => onDuplicate(z.id)}
              onArchiveToggle={() => onArchiveToggle(z)}
              onDelete={() => onDelete(z)}
            />
          ))}

        {!isLoading && visibleCount < zones.length && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Mostrando {visible.length} de {zones.length} — deslizá para ver más
          </p>
        )}
      </div>

      <div className="border-t border-border/60 px-4 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onToggleArchived}
        >
          <Archive className="size-4" />
          {showArchived ? "Ocultar zonas archivadas" : "Ver zonas archivadas"}
        </Button>
      </div>
    </Card>
  );
}
