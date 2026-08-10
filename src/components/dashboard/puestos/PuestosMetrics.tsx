"use client";

import { Building2, CheckCircle2, MapPin, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PuestoKpis } from "@/lib/types/puesto";
import { formatNumero, VACIO } from "./helpers";

interface Props {
  kpis?: PuestoKpis;
  loading?: boolean;
}

type Metric = {
  id: string;
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

function construir(kpis: PuestoKpis): Metric[] {
  const pct = (n: number) => `${n.toLocaleString("es-UY")}% del total`;
  return [
    {
      id: "total",
      label: "Total puestos",
      value: formatNumero(kpis.total),
      sub: VACIO,
      icon: Building2,
      accent: "bg-primary/10 text-primary",
    },
    {
      id: "activos",
      label: "Puestos activos",
      value: formatNumero(kpis.activos),
      sub: pct(kpis.pctActivos),
      icon: CheckCircle2,
      accent: "bg-emerald-500/10 text-emerald-400",
    },
    {
      id: "zona",
      label: "Con zona asignada",
      value: formatNumero(kpis.conZona),
      sub: pct(kpis.pctConZona),
      icon: MapPin,
      accent: "bg-amber-500/10 text-amber-400",
    },
    {
      id: "moviles",
      label: "Con móviles asociados",
      value: formatNumero(kpis.conMoviles),
      sub: pct(kpis.pctConMoviles),
      icon: Truck,
      accent: "bg-violet-500/10 text-violet-400",
    },
  ];
}

export default function PuestosMetrics({ kpis, loading }: Props) {
  if (loading || !kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-7 w-14 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {construir(kpis).map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.id} className="rounded-2xl">
            <CardContent className="flex items-center gap-4 p-5">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full",
                  m.accent,
                )}
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </p>
                <p className="text-2xl font-semibold leading-tight tabular-nums">
                  {m.value}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.sub}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
