"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ArrowLeft,
  Save,
  Copy,
  History,
  Warehouse,
  Power,
  Truck,
  RefreshCw,
  Wrench,
  Activity,
} from "lucide-react";
import { useMovil, useMovilMutations } from "@/hooks/moviles";
import { estadoBadge, servicioBadge, gpsBadge } from "@/lib/types/movil";
import type { UpdateMovilPayload } from "@/lib/types/movil";
import { ConfiguracionTab } from "./detalle/ConfiguracionTab";

function fmtFecha(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function MovilDetalle() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: movil, isLoading, isError, refetch } = useMovil(id ?? null);
  const mut = useMovilMutations(id ?? "");

  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("config"));
  const [draft, setDraft] = useState<UpdateMovilPayload>({});
  const [desactivarOpen, setDesactivarOpen] = useState(false);

  if (!id) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-destructive">ID de móvil no proporcionado</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !movil) {
    return (
      <div className="py-16">
        <EmptyState
          icon={RefreshCw}
          title="No se pudo cargar el móvil"
          description="Verificá tu conexión y reintentá."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  const guardar = () => {
    if (Object.keys(draft).length === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }
    mut.update.mutate(draft, {
      onSuccess: () => {
        toast.success("Cambios guardados");
        setDraft({});
      },
      onError: () => toast.error("Error al guardar los cambios"),
    });
  };

  const duplicar = () => {
    mut.duplicar.mutate(undefined, {
      onSuccess: (res) => {
        toast.success("Configuración duplicada");
        router.push(`/dashboard/moviles/${res.id}`);
      },
      onError: () => toast.error("Error al duplicar"),
    });
  };

  const confirmarDesactivar = () => {
    // Estado "inactivo": usamos estadoCodigo del catálogo si lo hay; acá disparamos
    // un PATCH que el usuario completará desde el form. Por simplicidad marcamos
    // rutea=false + estado conservado, dejando el cambio fino al form de estado.
    mut.update.mutate(
      { rutea: false },
      {
        onSuccess: () => {
          toast.success("Móvil desactivado del ruteo");
          setDesactivarOpen(false);
        },
        onError: () => toast.error("Error al desactivar"),
      },
    );
  };

  const est = estadoBadge(movil.estadoNombre);
  const srv = servicioBadge(movil.tipoServicio ?? movil.servicioPrincipal);
  const gps = gpsBadge(movil.tieneGps);
  const hasChanges = Object.keys(draft).length > 0;

  const resumenRows: { label: string; value: React.ReactNode }[] = [
    { label: "Fletera", value: movil.fleteraNombre || "—" },
    { label: "Estado", value: <Badge variant={est.variant}>{est.label}</Badge> },
    {
      label: "Servicio",
      value: (
        <Badge variant={srv.variant} className={srv.className}>
          {srv.label}
        </Badge>
      ),
    },
    { label: "Cap. bodega / lote", value: movil.capacidadLote ?? "—" },
    { label: "Teléfono", value: movil.telefono || "—" },
    { label: "Pedidos pendientes", value: movil.pedidosPendientes ?? "—" },
    { label: "GPS", value: <Badge variant={gps.variant}>{gps.label}</Badge> },
    { label: "Últ. actualización", value: fmtFecha(movil.ultimaActualizacion) },
  ];

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <nav className="text-xs text-muted-foreground">
            Inicio <span className="px-1">/</span> Logística{" "}
            <span className="px-1">/</span>{" "}
            <button
              onClick={() => router.push("/dashboard/moviles")}
              className="hover:text-foreground"
            >
              Móviles
            </button>{" "}
            <span className="px-1">/</span>{" "}
            <span className="text-foreground">{movil.numero}</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Móvil {movil.numero} · {movil.matricula || "sin matrícula"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configuración completa de la unidad (datos, ruteo, app, recarga y
            escenarios).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/moviles")}>
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <Button onClick={guardar} disabled={!hasChanges || mut.update.isPending}>
            <Save className="size-4" />
            Guardar cambios
          </Button>
          <Button variant="secondary" onClick={duplicar} disabled={mut.duplicar.isPending}>
            <Copy className="size-4" />
            Duplicar configuración
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">
        {/* Columna izquierda: resumen */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="gap-4 px-5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Resumen del móvil
                </p>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {movil.numero ?? "—"}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {movil.origen}
              </Badge>
            </div>
            {movil.matricula && (
              <Badge variant="secondary" className="w-fit font-mono">
                {movil.matricula}
              </Badge>
            )}
            <dl className="flex flex-col divide-y divide-border/60 text-sm">
              {resumenRows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="gap-2 px-5 py-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setTab("historial")}
            >
              <History className="size-4" />
              Ver historial
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setTab("bodega")}
            >
              <Warehouse className="size-4" />
              Ver bodega
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => setDesactivarOpen(true)}
            >
              <Power className="size-4" />
              Desactivar
            </Button>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v)}>
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="config">
              <Wrench className="size-4" />
              Configuración
            </TabsTrigger>
            <TabsTrigger value="historial">
              <History className="size-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="servicios">
              <Truck className="size-4" />
              Servicios
            </TabsTrigger>
            <TabsTrigger value="bodega">
              <Warehouse className="size-4" />
              Bodega
            </TabsTrigger>
            <TabsTrigger value="actividad">
              <Activity className="size-4" />
              Actividad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <ConfiguracionTab movil={movil} draft={draft} setDraft={setDraft} mut={mut} />
          </TabsContent>

          <TabsContent value="historial">
            <Card className="px-5 py-10">
              <EmptyState
                icon={History}
                title="Sin histórico registrado"
                description="No hay movimientos de estado cargados para este móvil."
              />
            </Card>
          </TabsContent>

          <TabsContent value="servicios">
            <Card className="px-5 py-10">
              <EmptyState
                icon={Truck}
                title="Servicios del móvil"
                description="Ver la sección 'Servicios habilitados' en la pestaña Configuración."
              />
            </Card>
          </TabsContent>

          <TabsContent value="bodega">
            <Card className="px-5 py-10">
              <EmptyState
                icon={Warehouse}
                title="Bodega"
                description={
                  movil.bodega.length
                    ? `${movil.bodega.length} producto(s) en bodega.`
                    : "Sin productos en bodega cargados."
                }
              />
            </Card>
          </TabsContent>

          <TabsContent value="actividad">
            <Card className="px-5 py-10">
              <EmptyState
                icon={Activity}
                title="Sin actividad registrada"
                description="La actividad del móvil se mostrará acá cuando esté disponible."
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal desactivar */}
      <Dialog open={desactivarOpen} onOpenChange={setDesactivarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar móvil</DialogTitle>
            <DialogDescription>
              El móvil {movil.numero} dejará de ser usado por el ruteo. Podés
              reactivarlo cambiando el estado desde la configuración.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesactivarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarDesactivar}
              disabled={mut.update.isPending}
            >
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
