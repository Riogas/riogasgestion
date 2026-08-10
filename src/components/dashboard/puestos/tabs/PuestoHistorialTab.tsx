"use client";

import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PuestoDetalle } from "@/lib/types/puesto";
import { formatFecha } from "../helpers";

/**
 * La tabla `puesto` no tiene bitácora. Lo único auditable hoy es `updatedAt`,
 * que se empezó a escribir con esta pantalla, así que se muestra ese único
 * evento real en lugar de inventar un historial que la base no guarda.
 */
export default function PuestoHistorialTab({ puesto }: { puesto: PuestoDetalle }) {
  if (!puesto.updatedAt) {
    return (
      <EmptyState
        icon={History}
        title="Sin actividad registrada."
        description="El historial se empieza a registrar a partir de la próxima edición del puesto."
        size="sm"
      />
    );
  }

  return (
    <ol className="space-y-3">
      <li className="flex gap-3">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm">Se actualizó información del puesto.</p>
          <p className="text-xs text-muted-foreground">{formatFecha(puesto.updatedAt)}</p>
        </div>
      </li>
    </ol>
  );
}
