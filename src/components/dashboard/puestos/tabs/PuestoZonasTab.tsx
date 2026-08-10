"use client";

import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ZonaOperativaDePuesto } from "@/lib/types/puesto";
import { formatNullable } from "../helpers";

interface Props {
  zonas: ZonaOperativaDePuesto[];
  onVerZonas: () => void;
}

export default function PuestoZonasTab({ zonas, onVerZonas }: Props) {
  if (zonas.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={MapPin}
          title="Este puesto no tiene una zona asignada."
          size="sm"
        />
        <Button variant="outline" size="sm" className="w-full" onClick={onVerZonas}>
          Asignar zona
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {zonas.map((z) => (
          <li key={z.id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              {/* El color lo define el usuario y vive en la base
                  (zona_operativa.color), así que va inline: no se puede
                  resolver a una clase de Tailwind en build time. */}
              <span
                className="size-3 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: z.color }}
                aria-hidden
              />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{z.nombre}</p>
              <Badge variant="outline" className="shrink-0 font-normal">
                {z.estado === "ACTIVE" ? "Activa" : "Archivada"}
              </Badge>
            </div>

            <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <dt>Tipo:</dt>
                <dd className="text-foreground">{formatNullable(z.tipoZona)}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Servicios:</dt>
                <dd className="min-w-0 flex-1 truncate text-foreground">
                  {z.servicios.length > 0 ? z.servicios.join(", ") : "—"}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <Button variant="outline" size="sm" className="w-full" onClick={onVerZonas}>
        Ver en el mapa
      </Button>
    </div>
  );
}
