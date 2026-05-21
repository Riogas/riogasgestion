"use client";

// src/app/dashboard/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { Sparkline } from "@/components/dashboard/charts/Sparkline";
import { chartColors } from "@/lib/chart-colors";
import {
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Package,
  Flame,
  TrendingUp,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

/* ============================================================
   Tipos + sub-componentes
   ============================================================ */

interface Trend {
  pct: number;
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
  sparkData,
  sparkColor,
}: {
  title: string;
  value: string;
  unit?: string;
  trend?: Trend;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "hero";
  sparkData?: Array<{ value: number }>;
  sparkColor?: string;
}) {
  const hero = variant === "hero";
  return (
    <Card variant={hero ? "hero" : "default"} className="card-hover-lift h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <span
            className={
              hero
                ? "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-primary/15 text-primary shrink-0"
                : "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-muted text-muted-foreground shrink-0"
            }
          >
            <Icon className={hero ? "h-5 w-5" : "h-4 w-4"} />
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-3">
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span
            className={
              hero
                ? "text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground"
                : "text-3xl font-bold tracking-tight text-foreground"
            }
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground font-medium">{unit}</span>
          )}
        </div>
        {sparkData && (
          <Sparkline
            data={sparkData}
            color={sparkColor ?? chartColors.primary}
            height={hero ? 56 : 40}
          />
        )}
        {trend && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendBadge trend={trend} />
            <span className="truncate">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Top zonas — leaderboard card
   ============================================================ */

function TopZonasCard() {
  const zonas = [
    { name: "Zona Norte", pedidos: 142, pct: 100 },
    { name: "Zona Centro", pedidos: 118, pct: 83 },
    { name: "Zona Sur", pedidos: 96, pct: 68 },
    { name: "Zona Este", pedidos: 71, pct: 50 },
    { name: "Zona Oeste", pedidos: 48, pct: 34 },
  ];
  return (
    <Card className="card-hover-lift h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Top zonas</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Pedidos hoy</p>
          </div>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {zonas.map((z, i) => (
          <div
            key={z.name}
            className="flex items-center gap-3 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground shrink-0 tabular-nums">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">
                  {z.name}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {z.pedidos}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${z.pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Donut: distribución por producto
   ============================================================ */

function ProductDonutCard() {
  const data = [
    { name: "13 kg", value: 5234, color: chartColors.primary },
    { name: "45 kg", value: 3120, color: chartColors.accent },
    { name: "Granel", value: 2876, color: chartColors.cyan },
    { name: "Otros", value: 1200, color: chartColors.purple },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card className="card-hover-lift h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Distribución por producto</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Kg entregados hoy</p>
          </div>
          <Flame className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          <div className="relative w-32 h-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold tabular-nums text-foreground">
                {total.toLocaleString()}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                kg total
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {data.map((d) => {
              const pct = ((d.value / total) * 100).toFixed(1);
              return (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-foreground flex-1 truncate">{d.name}</span>
                  <span className="text-muted-foreground tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Actividad reciente — tabla compacta
   ============================================================ */

type ActivityStatus = "completed" | "pending" | "alert";

function StatusBadge({ status }: { status: ActivityStatus }) {
  const map: Record<
    ActivityStatus,
    { label: string; variant: any; icon: React.ComponentType<{ className?: string }> }
  > = {
    completed: { label: "Entregado", variant: "success", icon: CheckCircle2 },
    pending: { label: "En curso", variant: "info", icon: Clock },
    alert: { label: "Demora", variant: "warn", icon: AlertTriangle },
  };
  const { label, variant, icon: Icon } = map[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function RecentActivityCard() {
  const rows = [
    { id: "P-1043", cliente: "Supermercado La Hueca", movil: "M-103", zona: "Norte", kg: 130, status: "completed" as const, hora: "08:42" },
    { id: "P-1044", cliente: "Restaurante El Tablón", movil: "M-117", zona: "Centro", kg: 90, status: "completed" as const, hora: "09:05" },
    { id: "P-1045", cliente: "Industria Solís S.A.", movil: "M-118", zona: "Este", kg: 360, status: "pending" as const, hora: "09:18" },
    { id: "P-1046", cliente: "Panadería Don Lalo", movil: "M-103", zona: "Norte", kg: 45, status: "completed" as const, hora: "09:34" },
    { id: "P-1047", cliente: "Hotel Las Lomas", movil: "M-105", zona: "Sur", kg: 180, status: "alert" as const, hora: "09:51" },
    { id: "P-1048", cliente: "Distribuidora Plata", movil: "M-117", zona: "Centro", kg: 270, status: "pending" as const, hora: "10:02" },
  ];
  return (
    <Card className="card-hover-lift h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos pedidos asignados
            </p>
          </div>
          <Truck className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 -mx-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Móvil</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead className="text-right">Kg</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow
                key={r.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <TableCell className="font-mono text-xs text-primary">{r.id}</TableCell>
                <TableCell className="font-medium">{r.cliente}</TableCell>
                <TableCell className="text-muted-foreground">{r.movil}</TableCell>
                <TableCell className="text-muted-foreground">{r.zona}</TableCell>
                <TableCell className="text-right tabular-nums">{r.kg}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.hora}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Tooltip glass común para charts
   ============================================================ */

const tooltipStyle = {
  background: "color-mix(in oklch, var(--card) 88%, transparent)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
  backdropFilter: "blur(8px)",
} as const;

/* ============================================================
   Page principal
   ============================================================ */

export default function DashboardPage() {
  // Datos demo (sparklines incluidos)
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

  // Sparklines (10 puntos cada uno)
  const usuariosSpark = [200, 215, 230, 220, 245, 260, 250, 270, 265, 280].map((v) => ({ value: v }));
  const ordenesSpark = [42, 50, 48, 55, 60, 58, 64, 62, 65, 68].map((v) => ({ value: v }));
  const kgSpark = [11200, 11500, 11900, 12100, 11800, 12400, 12200, 12500, 12300, 12430].map((v) => ({ value: v }));
  const movilesSpark = [12, 14, 13, 15, 14, 16, 15, 17, 16, 17].map((v) => ({ value: v }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Panel principal"
        description="Resumen operativo del día — métricas clave, actividad reciente y tendencias."
      />

      {/* ===== Row 1: 1 Hero + 3 KPIs (span 6 + 3·span 2 = 12) ===== */}
      <div className="bento-grid">
        <div className="bento-item-hero animate-fade-in-up stagger-1">
          <KpiCard
            title="Usuarios Activos"
            value="245"
            trend={{ pct: 12, label: "vs. semana pasada" }}
            icon={Users}
            variant="hero"
            sparkData={usuariosSpark}
            sparkColor={chartColors.primary}
          />
        </div>
        <div className="bento-item animate-fade-in-up stagger-2 lg:!col-span-2">
          <KpiCard
            title="Órdenes del Día"
            value="68"
            trend={{ pct: 7.4, label: "+5 última hora" }}
            icon={Package}
            sparkData={ordenesSpark}
            sparkColor={chartColors.accent}
          />
        </div>
        <div className="bento-item animate-fade-in-up stagger-3 lg:!col-span-2">
          <KpiCard
            title="Volumen entregado"
            value="12.430"
            unit="kg"
            trend={{ pct: 3.2, label: "vs. mes anterior" }}
            icon={Flame}
            sparkData={kgSpark}
            sparkColor={chartColors.cyan}
          />
        </div>
        <div className="bento-item animate-fade-in-up stagger-4 lg:!col-span-2">
          <KpiCard
            title="Móviles activos"
            value="17"
            trend={{ pct: -2.1, label: "vs. ayer" }}
            icon={Truck}
            sparkData={movilesSpark}
            sparkColor={chartColors.purple}
          />
        </div>
      </div>

      {/* ===== Row 2: Chart wide (span 8) + Top zonas (span 4) ===== */}
      <div className="bento-grid">
        <div className="bento-item-wide animate-fade-in-up stagger-5">
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
                  <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.25} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={tooltipStyle} />
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
        <div className="bento-item animate-fade-in-up stagger-6 lg:!col-span-4">
          <TopZonasCard />
        </div>
      </div>

      {/* ===== Row 3: Bars (span 4) + Line (span 4) + Donut (span 4) ===== */}
      <div className="bento-grid">
        <div className="bento-item animate-fade-in-up stagger-7 lg:!col-span-4">
          <ChartCard
            title="Órdenes por franja"
            description="Hoy"
            height={240}
          >
            <BarChart data={ordenesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.25} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={chartColors.accent} radius={[6, 6, 0, 0]} animationDuration={800} />
            </BarChart>
          </ChartCard>
        </div>
        <div className="bento-item animate-fade-in-up stagger-8 lg:!col-span-4">
          <ChartCard
            title="Volumen mensual"
            description="Kg — últimos 6 meses"
            height={240}
          >
            <LineChart data={ingresosData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.25} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip
                formatter={(v: any) => [`${v.toLocaleString()} kg`, "Kg"]}
                contentStyle={tooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColors.primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: chartColors.primary, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: chartColors.accent, strokeWidth: 2, stroke: "var(--card)" }}
                animationDuration={800}
              />
            </LineChart>
          </ChartCard>
        </div>
        <div className="bento-item animate-fade-in-up stagger-9 lg:!col-span-4">
          <ProductDonutCard />
        </div>
      </div>

      {/* ===== Row 4: Tabla de actividad reciente full width ===== */}
      <div className="bento-grid">
        <div className="bento-item-full animate-fade-in-up stagger-10">
          <RecentActivityCard />
        </div>
      </div>
    </div>
  );
}
