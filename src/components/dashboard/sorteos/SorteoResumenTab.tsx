"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Gift, MapPin, QrCode, Trophy, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { chartColors } from "@/lib/chart-colors";
import type { SorteoDetalle } from "@/lib/types/sorteo";
import { fmtDiaCorto, fmtDiaLargo, fmtNumero, porcentaje } from "./helpers";

const TOP_DEPARTAMENTOS = 8;

const tooltipStyle = {
  background: "color-mix(in oklch, var(--card) 88%, transparent)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
  backdropFilter: "blur(8px)",
} as const;

type KpiVariant = "primary" | "success" | "warn" | "info";

const KPI_ICON_CLASS: Record<KpiVariant, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warn: "bg-warn/10 text-warn",
  info: "bg-accent/10 text-accent",
};

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  variant,
  progress,
  index,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: KpiVariant;
  progress?: number;
  index: number;
}) {
  return (
    <Card
      className="card-hover-lift animate-fade-in-up h-full"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <CardContent className="flex flex-1 flex-col gap-3 pt-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${KPI_ICON_CLASS[variant]}`}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <p className="text-4xl font-extrabold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {typeof progress === "number" && (
          <Progress value={progress} aria-label={`${label}: ${progress}%`} />
        )}
        <p className="mt-auto text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function SorteoResumenTab({ sorteo }: { sorteo: SorteoDetalle }) {
  const { stats } = sorteo;

  const serieDias = useMemo(
    () =>
      stats.porDia.map((d) => ({
        dia: fmtDiaCorto(d.fecha),
        fecha: d.fecha,
        participaciones: d.cantidad,
        ganadores: d.ganadores,
      })),
    [stats.porDia],
  );

  const serieDepartamentos = useMemo(
    () => stats.porDepartamento.slice(0, TOP_DEPARTAMENTOS),
    [stats.porDepartamento],
  );

  const pendientes = Math.max(0, stats.ganadores - stats.premiosEntregados);
  const pctCodigos = porcentaje(stats.codigosUsados, stats.codigosTotal);
  const hayMasDepartamentos = stats.porDepartamento.length > TOP_DEPARTAMENTOS;

  return (
    <div className="space-y-5">
      <div className="bento-grid">
        <div className="bento-item lg:!col-span-3">
          <KpiCard
            index={0}
            label="Participaciones"
            value={fmtNumero(stats.participaciones)}
            hint={
              stats.codigosTotal > 0
                ? `${fmtNumero(stats.codigosUsados)} códigos canjeados de ${fmtNumero(stats.codigosTotal)}`
                : "Todavía no se generaron códigos"
            }
            icon={Users}
            variant="primary"
          />
        </div>
        <div className="bento-item lg:!col-span-3">
          <KpiCard
            index={1}
            label="Ganadores"
            value={fmtNumero(stats.ganadores)}
            hint={`De ${fmtNumero(sorteo.cantidadPremios)} premios configurados`}
            icon={Trophy}
            variant="success"
          />
        </div>
        <div className="bento-item lg:!col-span-3">
          <KpiCard
            index={2}
            label="Premios pendientes"
            value={fmtNumero(pendientes)}
            hint={`${fmtNumero(stats.premiosEntregados)} entregados`}
            icon={Gift}
            variant="warn"
          />
        </div>
        <div className="bento-item lg:!col-span-3">
          <KpiCard
            index={3}
            label="Códigos usados"
            value={`${fmtNumero(stats.codigosUsados)}/${fmtNumero(stats.codigosTotal)}`}
            hint={`${pctCodigos}% del total generado`}
            icon={QrCode}
            variant="info"
            progress={pctCodigos}
          />
        </div>
      </div>

      <div className="bento-grid">
        <div className="bento-item-wide animate-fade-in-up stagger-5">
          <ChartCard
            title="Participaciones por día"
            description="Hora de Montevideo — incluye la curva de ganadores"
            height={300}
            emptyState={
              <>
                <CalendarDays className="size-8 opacity-40" />
                <p className="text-xs">Todavía no hay participaciones registradas</p>
              </>
            }
          >
            {serieDias.length > 0 ? (
              <LineChart data={serieDias} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis
                  dataKey="dia"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(_label, payload) =>
                    fmtDiaLargo(payload?.[0]?.payload?.fecha)
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  name="Participaciones"
                  type="monotone"
                  dataKey="participaciones"
                  stroke={chartColors.primary}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: chartColors.primary, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: chartColors.primary, strokeWidth: 2, stroke: "var(--card)" }}
                  animationDuration={800}
                />
                <Line
                  name="Ganadores"
                  type="monotone"
                  dataKey="ganadores"
                  stroke={chartColors.accent}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: chartColors.accent, strokeWidth: 0 }}
                  activeDot={{ r: 4.5, fill: chartColors.accent, strokeWidth: 2, stroke: "var(--card)" }}
                  animationDuration={800}
                />
              </LineChart>
            ) : null}
          </ChartCard>
        </div>

        <div className="bento-item animate-fade-in-up stagger-6 lg:!col-span-4">
          <ChartCard
            title="Participaciones por departamento"
            description={
              hayMasDepartamentos
                ? `Top ${TOP_DEPARTAMENTOS} de ${stats.porDepartamento.length}`
                : "Según GPS o IP del participante"
            }
            height={300}
            emptyState={
              <>
                <MapPin className="size-8 opacity-40" />
                <p className="text-xs">Sin datos de ubicación todavía</p>
              </>
            }
          >
            {serieDepartamentos.length > 0 ? (
              <BarChart
                data={serieDepartamentos}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  type="category"
                  dataKey="departamento"
                  width={104}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                <Bar
                  name="Participaciones"
                  dataKey="cantidad"
                  fill={chartColors.accent}
                  radius={[0, 6, 6, 0]}
                  barSize={18}
                  animationDuration={800}
                />
              </BarChart>
            ) : null}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
