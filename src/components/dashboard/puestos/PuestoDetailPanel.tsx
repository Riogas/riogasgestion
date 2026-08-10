"use client";

import { Building2, Eye, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PuestoDetalle } from "@/lib/types/puesto";
import { esActivo, mapEstado } from "./helpers";
import PuestoInfoTab from "./tabs/PuestoInfoTab";
import PuestoMovilesTab from "./tabs/PuestoMovilesTab";
import PuestoZonasTab from "./tabs/PuestoZonasTab";
import PuestoHistorialTab from "./tabs/PuestoHistorialTab";

interface Props {
  puesto?: PuestoDetalle;
  loading: boolean;
  error: boolean;
  onEditar: () => void;
  onNuevo: () => void;
  onReintentar: () => void;
  onVerMoviles: () => void;
  onVerZonas: () => void;
}

export default function PuestoDetailPanel({
  puesto,
  loading,
  error,
  onEditar,
  onNuevo,
  onReintentar,
  onVerMoviles,
  onVerZonas,
}: Props) {
  if (error) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-10">
          <EmptyState
            icon={Building2}
            title="No se pudo cargar el puesto."
            description="Puede ser un problema momentáneo de conexión."
            action={
              <Button variant="outline" size="sm" onClick={onReintentar}>
                Reintentar
              </Button>
            }
            size="sm"
          />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="space-y-4 p-5">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded bg-muted" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!puesto) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12">
          <EmptyState
            icon={Building2}
            title="Seleccioná un puesto del listado para ver su información."
            action={
              <Button variant="outline" size="sm" onClick={onNuevo}>
                Crear nuevo puesto
              </Button>
            }
            size="sm"
          />
        </CardContent>
      </Card>
    );
  }

  const activo = esActivo(puesto.estado);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Puesto seleccionado
            </p>
            <h2 className="truncate text-xl font-semibold">
              {puesto.nombre ?? "Sin nombre"}
            </h2>
            <p className="text-sm text-muted-foreground">ID {puesto.id}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 font-normal",
              activo
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {mapEstado(puesto.estado)}
          </Badge>
        </div>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="moviles">Móviles ({puesto.movilesLista.length})</TabsTrigger>
            <TabsTrigger value="zonas">Zonas ({puesto.zonas.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <PuestoInfoTab puesto={puesto} />
          </TabsContent>

          <TabsContent value="moviles" className="mt-4">
            <PuestoMovilesTab
              moviles={puesto.movilesLista}
              total={puesto.moviles}
              onVerMoviles={onVerMoviles}
            />
          </TabsContent>

          <TabsContent value="zonas" className="mt-4">
            <PuestoZonasTab zonas={puesto.zonas} onVerZonas={onVerZonas} />
          </TabsContent>

          <TabsContent value="historial" className="mt-4">
            <PuestoHistorialTab puesto={puesto} />
          </TabsContent>
        </Tabs>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onEditar} className="gap-2">
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button variant="outline" onClick={onVerMoviles} className="gap-2">
            <Eye className="size-4" />
            Ver detalle completo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
