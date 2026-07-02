"use client";

import { Clock, Moon, Zap } from "lucide-react";

// Leyenda flotante del mapa (abajo-izquierda).
export function MapLegend() {
  return (
    <div className="pointer-events-auto rounded-xl border border-border bg-card/90 px-3.5 py-2.5 shadow-md backdrop-blur">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Referencias
      </p>
      <ul className="space-y-1 text-xs text-foreground/90">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-violet-500" />
          Distribución
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-cyan-400" />
          Flete
        </li>
        <li className="flex items-center gap-2">
          <Zap className="size-3.5 text-amber-400" />
          Urgente
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-3.5 text-sky-400" />
          Service
        </li>
        <li className="flex items-center gap-2">
          <Moon className="size-3.5 text-indigo-300" />
          Nocturno
        </li>
      </ul>
    </div>
  );
}
