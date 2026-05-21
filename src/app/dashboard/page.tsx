"use client";

// src/app/dashboard/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { chartColors } from "@/lib/chart-colors";
import { ArrowUpRight, ArrowDownRight, Users, Package, Flame } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

interface Trend {
  /** Percent change vs. prior period (positive = up, negative = down). */
  pct: number;
  /** Human label, e.g. "vs. semana pasada". */
  label: string;
}

function TrendBadge({ trend }: { trend: Trend }) {
  const positive = trend.pct >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <Badge variant={positive ? "success" : "destructive"} className="gap-1">
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {trend.pct.toFixed(1)}%
    </Badge>
  );
}

function KpiCard({
  title,
  value,
  unit,
  trend,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string;
  unit?: string;
  trend?: Trend;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "hero";
}) {
  return (
    <Card
      variant={variant}
      className="card-hover-lift animate-fade-in-up"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <span
            className={
              variant === "hero"
                ? "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-primary/15 text-primary"
                : "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-muted text-muted-foreground"
            }
          >
            <Icon className={variant === "hero" ? "h-5 w-5" : "h-4 w-4"} />
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span
            className={
              variant === "hero"
                ? "text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground"
                : "text-3xl font-bold tracking-tight text-foreground"
            }
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground font-medium">
              {unit}
            </span>
          )}
        </div>
        {trend && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendBadge trend={trend} />
            <span>{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const usuariosData = [
    { name: "Lun", value: 210 },
    { name: "Mar", value: 240 },
    { name: "Mié", value: 230 },
    { name: "Jue", value: 260 },
    { name: "Vie", value: 280 },
    { name: "Sáb", value: 300 },
    { name: "Dom", value: 290 },
  ];

  const ordenesData = [
    { name: "8h", value: 5 },
    { name: "10h", value: 9 },
    { name: "12h", value: 12 },
    { name: "14h", value: 7 },
    { name: "16h", value: 15 },
    { name: "18h", value: 20 },
  ];

  const ingresosData = [
    { name: "Ene", value: 8200 },
    { name: "Feb", value: 10400 },
    { name: "Mar", value: 9300 },
    { name: "Abr", value: 12200 },
    { name: "May", value: 11400 },
    { name: "Jun", value: 13430 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel principal"
        description="Resumen operativo del día — métricas clave, actividad reciente y tendencias."
      />

      {/* Bento KPI row: 1 hero (span 6) + 3 secondary (span 2 each) */}
      <div className="bento-grid">
        <div className="bento-item-hero animate-fade-in-up stagger-1">
          <KpiCard
            title="Usuarios Activos"
            value="245"
            trend={{ pct: 12, label: "vs. semana pasada" }}
            icon={Users}
            variant="hero"
          />
        </div>
        <div className="bento-item animate-fade-in-up stagger-2">
          <KpiCard
            title="Órdenes del Día"
            value="68"
            trend={{ pct: 7.4, label: "+5 en la última hora" }}
            icon={Package}
          />
        </div>
        <div className="bento-item animate-fade-in-up stagger-3">
          <KpiCard
            title="Volumen entregado"
            value="12.430"
            unit="kg"
            trend={{ pct: 3.2, label: "vs. mes anterior" }}
            icon={Flame}
          />
        </div>
      </div>

      {/* Charts row: wide chart (span 8) + side chart (span 4) */}
      <div className="bento-grid">
        <div className="bento-item-wide animate-fade-in-up stagger-4">
          <ChartCard
            title="Usuarios activos"
            description="Últimos 7 días"
            height={300}
          >
            <AreaChart
              data={usuariosData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={chartColors.primary}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={chartColors.primary}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                strokeOpacity={0.25}
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "color-mix(in oklch, var(--card) 88%, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                  backdropFilter: "blur(8px)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColors.primary}
                strokeWidth={2}
                fill="url(#colorUsers)"
                animationDuration={800}
              />
            </AreaChart>
          </ChartCard>
        </div>
        <div className="bento-item animate-fade-in-up stagger-5">
          <ChartCard
            title="Órdenes por franja"
            description="Hoy"
            height={300}
          >
            <BarChart
              data={ordenesData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                strokeOpacity={0.25}
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "color-mix(in oklch, var(--card) 88%, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                  backdropFilter: "blur(8px)",
                }}
              />
              <Bar
                dataKey="value"
                fill={chartColors.accent}
                radius={[8, 8, 0, 0]}
                animationDuration={800}
              />
            </BarChart>
          </ChartCard>
        </div>
      </div>

      {/* Full-width trend chart */}
      <div className="bento-grid">
        <div className="bento-item-full animate-fade-in-up stagger-6">
          <ChartCard
            title="Volumen mensual"
            description="Kg entregados — últimos 6 meses"
            height={260}
          >
            <LineChart
              data={ingresosData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                strokeOpacity={0.25}
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                formatter={(v: any) => [`${v.toLocaleString()} kg`, "Kg"]}
                contentStyle={{
                  background: "color-mix(in oklch, var(--card) 88%, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                  backdropFilter: "blur(8px)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColors.primary}
                strokeWidth={2.5}
                dot={{ r: 4, fill: chartColors.primary, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: chartColors.accent, strokeWidth: 2, stroke: "var(--card)" }}
                animationDuration={800}
              />
            </LineChart>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
