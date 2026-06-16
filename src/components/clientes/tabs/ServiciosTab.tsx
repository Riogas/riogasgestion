"use client";

import { Wrench, Calendar, User, ArrowRight } from "lucide-react";
import { type Cliente } from "@/lib/types/cliente";

interface ServiciosTabProps {
  cliente: Cliente;
}

/** Placeholder visual — tarjetas fantasma de servicios */
function GhostCards() {
  const cards = [
    { titleW: "w-32", subtitleW: "w-24", badgeW: "w-16" },
    { titleW: "w-28", subtitleW: "w-20", badgeW: "w-20" },
    { titleW: "w-36", subtitleW: "w-28", badgeW: "w-14" },
  ];

  return (
    <div
      className="mt-6 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 opacity-30 select-none pointer-events-none"
      aria-hidden="true"
    >
      {cards.map((c, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className={`h-2.5 ${c.titleW} bg-muted rounded`} />
            <div className={`h-5 ${c.badgeW} bg-muted rounded-full`} />
          </div>
          <div className={`h-2 ${c.subtitleW} bg-muted rounded`} />
          <div className="h-2 w-full bg-muted/60 rounded" />
          <div className="h-2 w-3/4 bg-muted/60 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ServiciosTab({ cliente }: ServiciosTabProps) {
  // cliente disponible para cuando se conecte el backend
  void cliente;

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 gap-3">
      {/* Ícono */}
      <div className="inline-flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground h-16 w-16">
        <Wrench className="h-8 w-8 opacity-60" />
      </div>

      {/* Texto principal */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Servicios contratados
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Aquí aparecerán los servicios activos e historial de instalaciones del
          cliente — disponible cuando el módulo de Servicios se conecte al backend
          de producción.
        </p>
      </div>

      {/* Chips informativos */}
      <div className="flex flex-wrap justify-center gap-2 mt-1">
        {[
          { icon: Wrench, label: "Tipo de servicio" },
          { icon: Calendar, label: "Fecha de inicio" },
          { icon: User, label: "Técnico asignado" },
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

      {/* Ghost cards */}
      <GhostCards />
    </div>
  );
}
