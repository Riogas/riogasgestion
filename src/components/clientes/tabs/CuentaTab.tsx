"use client";

import { Receipt, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { type Cliente } from "@/lib/types/cliente";

interface CuentaTabProps {
  cliente: Cliente;
}

/** Placeholder visual — KPIs fantasma de saldo y movimientos */
function GhostKpis() {
  return (
    <div
      className="mt-6 w-full max-w-2xl opacity-30 select-none pointer-events-none"
      aria-hidden="true"
    >
      {/* KPI cards row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { icon: DollarSign, labelW: "w-14" },
          { icon: TrendingUp, labelW: "w-20" },
          { icon: TrendingDown, labelW: "w-18" },
        ].map(({ icon: Icon, labelW }, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-4 flex flex-col items-center gap-2"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="h-6 w-16 bg-muted rounded" />
            <div className={`h-2 ${labelW} bg-muted/60 rounded`} />
          </div>
        ))}
      </div>
      {/* Movimientos table ghost */}
      <div className="rounded-[var(--radius-md)] border border-border overflow-hidden">
        <div className="flex gap-4 px-3 py-2.5 bg-muted/30 border-b border-border">
          <div className="h-2.5 w-16 bg-muted rounded" />
          <div className="h-2.5 w-24 bg-muted rounded" />
          <div className="h-2.5 w-14 bg-muted rounded ml-auto" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex gap-4 px-3 py-3 border-b border-border/50 last:border-b-0"
          >
            <div className="h-2.5 w-14 bg-muted rounded" />
            <div className="h-2.5 w-28 bg-muted rounded" />
            <div className="h-2.5 w-12 bg-muted rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CuentaTab({ cliente }: CuentaTabProps) {
  // cliente disponible para cuando se conecte el backend
  void cliente;

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 gap-3">
      {/* Ícono */}
      <div className="inline-flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground h-16 w-16">
        <Receipt className="h-8 w-8 opacity-60" />
      </div>

      {/* Texto principal */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Cuenta y saldos
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Aquí aparecerán el saldo actual, movimientos y estado de cuenta del
          cliente — disponible cuando el módulo de Cuenta se conecte al backend
          de producción.
        </p>
      </div>

      {/* Chips informativos */}
      <div className="flex flex-wrap justify-center gap-2 mt-1">
        {[
          { icon: DollarSign, label: "Saldo actual" },
          { icon: TrendingUp, label: "Crédito" },
          { icon: TrendingDown, label: "Débito" },
          { icon: Receipt, label: "Movimientos" },
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

      {/* Ghost KPIs + table */}
      <GhostKpis />
    </div>
  );
}
