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
import { useQueryState } from "nuqs";
import { CalendarDays, Gift, MapPin, QrCode, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { chartColors } from "@/lib/chart-colors";
import type { SorteoDetalle } from "@/lib/types/sorteo";
import {
  agruparDepartamentos,
  fmtDiaCorto,
  fmtDiaLargo,
  fmtNumero,
  porcentaje,
  SORTEO_TABS,
  type SorteoTabValue,
} from "./helpers";

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

/**
 * Un line chart con UN solo punto queda como dos puntos flotando sin línea y
 * parece roto — y un único día con actividad es el caso más común cuando la
 * campaña arranca. Acá ese día se muestra como cifra grande con contexto.
 */
function ResumenDiaUnico({
  dia,
}: {
  dia: { fecha: string; participaciones: number; ganadores: number };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
        <CalendarDays className="size-3.5" aria-hidden />
        {fmtDiaLargo(dia.fecha)}
      </span>
      <div className="flex items-stretch gap-8 sm:gap-12">
        <div className="flex flex-col items-center gap-1">
          <p className="text-5xl font-extrabold tabular-nums tracking-tight text-primary">
            {fmtNumero(dia.participaciones)}
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {dia.participaciones === 1 ? "Participación" : "Participaciones"}
          </p>
        </div>
        <div className="w-px bg-border/60" aria-hidden />
        <div className="flex flex-col items-center gap-1">
          <p className="text-5xl font-extrabold tabular-nums tracking-tight text-accent">
            {fmtNumero(dia.ganadores)}
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {dia.ganadores === 1 ? "Ganador" : "Ganadores"}
          </p>
        </div>
      </div>
      <p className="max-w-[38ch] text-xs leading-relaxed text-pretty text-muted-foreground">
        Toda la actividad es de este día. La curva diaria aparece cuando el sorteo
        acumule participaciones en al menos dos días.
      </p>
    </div>
  );
}

export function SorteoResumenTab({ sorteo }: { sorteo: SorteoDetalle }) {
  const { stats } = sorteo;

  // Misma clave nuqs que SorteoDetalle: setearla acá cambia la tab activa.
  const [, setTab] = useQueryState<SorteoTabValue>("tab", {
    defaultValue: "resumen",
    parse: (v): SorteoTabValue =>
      SORTEO_TABS.includes(v as SorteoTabValue) ? (v as SorteoTabValue) : "resumen",
    serialize: (v) => v,
    shallow: true,
  });

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

  const { series: departamentos, sinUbicacion } = useMemo(
    () => agruparDepartamentos(stats.porDepartamento),
    [stats.porDepartamento],
  );

  const serieDepartamentos = departamentos.slice(0, TOP_DEPARTAMENTOS);
  const pendientes = Math.max(0, stats.ganadores - stats.premiosEntregados);
  const pctCodigos = porcentaje(stats.codigosUsados, stats.codigosTotal);

  const detalleDepartamentos = [
    departamentos.length > TOP_DEPARTAMENTOS
      ? `Top ${TOP_DEPARTAMENTOS} de ${departamentos.length}`
      : "Según el GPS del celular o, si no lo compartió, su IP",
    sinUbicacion > 0 ? `${fmtNumero(sinUbicacion)} sin ubicación precisa` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
            raw={serieDias.length === 1}
            emptyState={
              <div className="flex max-w-sm flex-col items-center gap-4 px-4">
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <CalendarDays className="size-6 text-primary" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    Todavía no hay participaciones
                  </p>
                  <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
                    {stats.codigosTotal === 0
                      ? "El primer paso es generar un lote de códigos QR: repartilos en los puntos de venta y acá vas a ver la actividad día a día."
                      : "Los códigos ya están generados. Apenas alguien escanee un QR y complete el formulario, acá se dibuja la actividad diaria."}
                  </p>
                </div>
                {stats.codigosTotal === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setTab("codigos")}>
                    <QrCode className="size-4" />
                    Generar el primer lote
                  </Button>
                )}
              </div>
            }
          >
            {serieDias.length === 1 ? (
              <ResumenDiaUnico dia={serieDias[0]} />
            ) : serieDias.length > 1 ? (
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
            description={detalleDepartamentos}
            height={300}
            emptyState={
              <div className="flex max-w-xs flex-col items-center gap-4 px-4">
                <div className="flex size-14 items-center justify-center rounded-full bg-accent/10">
                  <MapPin className="size-6 text-accent" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    Sin datos de ubicación todavía
                  </p>
                  <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
                    Cuando los participantes compartan su GPS —o su IP permita
                    ubicarlos— vas a ver acá de qué departamentos llegan.
                  </p>
                </div>
              </div>
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
