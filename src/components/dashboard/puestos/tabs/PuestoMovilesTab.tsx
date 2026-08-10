"use client";

import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { MovilDePuesto } from "@/lib/types/puesto";
import { formatFecha, formatNullable } from "../helpers";

interface Props {
  moviles: MovilDePuesto[];
  total: number;
  onVerMoviles: () => void;
}

/** El detalle trae hasta 50 móviles: Montevideo tiene 416 y traerlos todos
 *  inflaría la respuesta sin que nadie los lea en un panel lateral. */
export default function PuestoMovilesTab({ moviles, total, onVerMoviles }: Props) {
  if (moviles.length === 0) {
    return (
      <EmptyState icon={Truck} title="Este puesto no tiene móviles asociados." size="sm" />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Móviles asociados</p>
        {total > moviles.length && (
          <span className="text-xs text-muted-foreground">
            mostrando {moviles.length} de {total}
          </span>
        )}
      </div>

      <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {moviles.map((m) => {
          const activo = m.estadoCodigo === 1;
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Truck className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  Móvil {m.numeroMovil ?? m.id}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatNullable(m.descripcion ?? m.matricula)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-normal",
                    activo
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {activo ? "Activo" : "Inactivo"}
                </Badge>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatFecha(m.ultimaPosicionAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <Button variant="outline" size="sm" className="w-full" onClick={onVerMoviles}>
        Ver móviles
      </Button>
    </div>
  );
}
