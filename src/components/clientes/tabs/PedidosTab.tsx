"use client";

import { Package, ArrowRight, Clock, MapPin, Hash } from "lucide-react";
import { type Cliente } from "@/lib/types/cliente";

interface PedidosTabProps {
  cliente: Cliente;
}

/** Placeholder visual — tabla fantasma de cómo se verá el historial de pedidos */
function GhostTable() {
  const rows = [
    { width: "w-20", cols: ["w-16", "w-28", "w-20", "w-16", "w-24"] },
    { width: "w-24", cols: ["w-14", "w-32", "w-16", "w-20", "w-20"] },
    { width: "w-16", cols: ["w-18", "w-24", "w-24", "w-12", "w-28"] },
  ];

  return (
    <div className="mt-6 w-full max-w-2xl opacity-30 select-none pointer-events-none" aria-hidden="true">
      {/* Header fila */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border">
        <div className="h-3 w-10 bg-muted rounded" />
        <div className="h-3 w-20 bg-muted rounded" />
        <div className="h-3 w-16 bg-muted rounded" />
        <div className="h-3 w-14 bg-muted rounded ml-auto" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
      {/* Filas fantasma */}
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-3 py-3 border-b border-border/50"
        >
          <div className={`h-2.5 ${row.cols[0]} bg-muted rounded`} />
          <div className={`h-2.5 ${row.cols[1]} bg-muted rounded`} />
          <div className={`h-2.5 ${row.cols[2]} bg-muted rounded`} />
          <div className={`h-5 w-14 bg-muted rounded-full ml-auto`} />
          <div className={`h-2.5 ${row.cols[4]} bg-muted rounded`} />
        </div>
      ))}
    </div>
  );
}

export function PedidosTab({ cliente }: PedidosTabProps) {
  // cliente disponible para cuando se conecte el backend
  void cliente;

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 gap-3">
      {/* Ícono */}
      <div className="inline-flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground h-16 w-16">
        <Package className="h-8 w-8 opacity-60" />
      </div>

      {/* Texto principal */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Historial de pedidos
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Aquí aparecerá el historial de pedidos del cliente — disponible cuando el
          módulo de Pedidos deje de usar datos de demostración y se conecte al
          backend de producción.
        </p>
      </div>

      {/* Chips informativos */}
      <div className="flex flex-wrap justify-center gap-2 mt-1">
        {[
          { icon: Hash, label: "N° de pedido" },
          { icon: Clock, label: "Fecha y hora" },
          { icon: MapPin, label: "Dirección de entrega" },
          { icon: ArrowRight, label: "Estado" },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1"
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        ))}
      </div>

      {/* Ghost table */}
      <GhostTable />
    </div>
  );
}
