"use client";

import { useParams, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  CalendarRange,
  Gift,
  QrCode,
  RefreshCw,
  Settings2,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSorteo } from "@/hooks/sorteos";
import { estadoSorteoBadge, type SorteoDetalle as SorteoDetalleData } from "@/lib/types/sorteo";
import { SorteoResumenTab } from "./SorteoResumenTab";
import { SorteoCodigosTab } from "./SorteoCodigosTab";
import { SorteoParticipantesTab } from "./SorteoParticipantesTab";
import { SorteoGanadoresTab } from "./SorteoGanadoresTab";
import { SorteoConfigTab } from "./SorteoConfigTab";
import { fmtFechaHora, fmtNumero } from "./helpers";

const TABS = ["resumen", "codigos", "participantes", "ganadores", "config"] as const;
type TabValue = (typeof TABS)[number];

function TabContent({ tab, sorteo }: { tab: TabValue; sorteo: SorteoDetalleData }) {
  switch (tab) {
    case "resumen":
      return <SorteoResumenTab sorteo={sorteo} />;
    case "codigos":
      return <SorteoCodigosTab sorteo={sorteo} />;
    case "participantes":
      return <SorteoParticipantesTab sorteo={sorteo} />;
    case "ganadores":
      return <SorteoGanadoresTab sorteo={sorteo} />;
    case "config":
      return <SorteoConfigTab sorteo={sorteo} />;
  }
}

export default function SorteoDetalle() {
  const params = useParams();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sorteoId = Number(rawId);
  const idValido = Number.isInteger(sorteoId) && sorteoId > 0;

  const [tab, setTab] = useQueryState<TabValue>("tab", {
    defaultValue: "resumen",
    parse: (v): TabValue => (TABS.includes(v as TabValue) ? (v as TabValue) : "resumen"),
    serialize: (v) => v,
    shallow: true,
  });

  const { data: sorteo, isLoading, isError, refetch } = useSorteo(idValido ? sorteoId : null);

  const variants = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
        exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
      };

  if (!idValido) {
    return (
      <EmptyState
        icon={Gift}
        title="Sorteo inexistente"
        description="El identificador de la URL no es válido."
        action={
          <Button variant="outline" onClick={() => router.push("/dashboard/sorteos")}>
            <ArrowLeft className="size-4" />
            Volver a sorteos
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-muted/70" />
          <div className="h-8 w-72 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="h-10 w-full animate-pulse rounded bg-muted/60" />
        <div className="bento-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bento-item lg:!col-span-3">
              <div className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-[var(--radius-lg)] bg-muted/60" />
      </div>
    );
  }

  if (isError || !sorteo) {
    return (
      <Card className="py-10">
        <EmptyState
          icon={RefreshCw}
          title="No se pudo cargar el sorteo"
          description="Verificá tu conexión y reintentá."
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard/sorteos")}>
                <ArrowLeft className="size-4" />
                Volver
              </Button>
              <Button onClick={() => refetch()}>
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  const badge = estadoSorteoBadge(sorteo.estado);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between animate-fade-in-up">
        <div className="min-w-0">
          <nav className="text-xs text-muted-foreground">
            Inicio <span className="px-1">/</span>{" "}
            <button
              onClick={() => router.push("/dashboard/sorteos")}
              className="transition-colors hover:text-foreground"
            >
              Sorteos
            </button>{" "}
            <span className="px-1">/</span>{" "}
            <span className="text-foreground">{sorteo.nombre}</span>
          </nav>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              {sorteo.nombre}
            </h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Gift className="size-4 text-primary" />
              {sorteo.premioDescripcion}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarRange className="size-4" />
              {fmtFechaHora(sorteo.fechaDesde)} — {fmtFechaHora(sorteo.fechaHasta)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/sorteos")}>
            <ArrowLeft className="size-4" />
            Volver
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="gap-0">
        <TabsList className="shrink-0 overflow-x-auto">
          <TabsTrigger value="resumen">
            <BarChart3 className="size-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="codigos">
            <QrCode className="size-4" />
            Códigos
            <CountBadge count={sorteo.stats.codigosTotal} />
          </TabsTrigger>
          <TabsTrigger value="participantes">
            <Users className="size-4" />
            Participantes
            <CountBadge count={sorteo.stats.participaciones} />
          </TabsTrigger>
          <TabsTrigger value="ganadores">
            <Trophy className="size-4" />
            Ganadores
            <CountBadge count={sorteo.stats.ganadores} />
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings2 className="size-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <div className="pt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} {...variants}>
              <TabContent tab={tab} sorteo={sorteo} />
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {fmtNumero(count)}
    </span>
  );
}
