"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { Building2, FileSpreadsheet, Layers, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePuesto, usePuestoFiltros, usePuestoKpis, usePuestos } from "@/hooks/puestos";
import type { QueryPuestosParams } from "@/lib/types/puesto";
import PuestoDetailPanel from "./PuestoDetailPanel";
import PuestoFormDrawer from "./PuestoFormDrawer";
import PuestosFilters from "./PuestosFilters";
import PuestosMetrics from "./PuestosMetrics";
import PuestosTable from "./PuestosTable";
import {
  FILTROS_VACIOS,
  formatLatLng,
  mapBoolean,
  mapEstado,
  type FiltrosPuestos,
} from "./helpers";

export default function PuestosView() {
  const router = useRouter();

  // El puesto seleccionado y la página viven en la URL: compartir el link
  // reabre la pantalla en el mismo estado.
  const [seleccionadoId, setSeleccionadoId] = useQueryState(
    "puesto",
    parseAsInteger,
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState(
    "size",
    parseAsInteger.withDefault(10),
  );
  const [searchAplicada, setSearchAplicada] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );

  // Borrador de los filtros: se aplican al presionar "Aplicar" (o Enter).
  const [borrador, setBorrador] = useState<FiltrosPuestos>({
    ...FILTROS_VACIOS,
    search: searchAplicada,
  });
  const [aplicados, setAplicados] = useState<FiltrosPuestos>({
    ...FILTROS_VACIOS,
    search: searchAplicada,
  });

  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(false);

  const params = useMemo<QueryPuestosParams>(
    () => ({
      page,
      pageSize,
      search: aplicados.search || undefined,
      estado: aplicados.estado !== "todos" ? aplicados.estado : undefined,
      departamentoId:
        aplicados.departamentoId !== "todos" ? Number(aplicados.departamentoId) : undefined,
      conZona: aplicados.conZona !== "todos" ? (aplicados.conZona as "con" | "sin") : undefined,
      conMoviles:
        aplicados.conMoviles !== "todos" ? (aplicados.conMoviles as "con" | "sin") : undefined,
    }),
    [page, pageSize, aplicados],
  );

  const lista = usePuestos(params);
  const kpis = usePuestoKpis();
  const filtros = usePuestoFiltros();
  const detalle = usePuesto(seleccionadoId);

  const departamentos = filtros.data?.departamentos ?? [];

  const hayFiltros =
    aplicados.search !== "" ||
    aplicados.estado !== "todos" ||
    aplicados.departamentoId !== "todos" ||
    aplicados.conZona !== "todos" ||
    aplicados.conMoviles !== "todos";

  const aplicar = useCallback(() => {
    setAplicados(borrador);
    setSearchAplicada(borrador.search || null);
    setPage(1);
  }, [borrador, setPage, setSearchAplicada]);

  const limpiar = useCallback(() => {
    setBorrador({ ...FILTROS_VACIOS });
    setAplicados({ ...FILTROS_VACIOS });
    setSearchAplicada(null);
    setPage(1);
  }, [setPage, setSearchAplicada]);

  const exportar = useCallback(() => {
    const items = lista.data?.items ?? [];
    if (items.length === 0) {
      toast.error("No hay puestos para exportar con los filtros actuales.");
      return;
    }

    const headers = [
      "ID", "Nombre", "Departamento", "Dirección", "Localidad", "Zonas operativas",
      "Móviles", "Estado", "Propio", "Auto pedido", "Flete cobra", "Flete cantidad",
      "Horarios", "Email", "Teléfono", "Lat/Lng", "Última actualización",
    ];

    // Neutraliza la inyección de fórmulas: un nombre que empiece con = o +
    // se ejecutaría al abrir el archivo en Excel.
    const escape = (v: unknown) => {
      let s = v === null || v === undefined ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };

    const filas = items.map((p) =>
      [
        p.id, p.nombre ?? "", p.departamentoNombre ?? "", p.direccion ?? "",
        p.localidadNombre ?? "", p.zonasOperativas, p.moviles, mapEstado(p.estado),
        mapBoolean(p.propio), mapBoolean(p.autopedido), mapBoolean(p.fleteCobra),
        p.fleteCantidad ?? "", p.horarios ?? "", p.mail ?? "", p.telefono ?? "",
        formatLatLng(p.lat, p.lng), p.updatedAt ?? "",
      ].map(escape).join(","),
    );

    const csv = [headers.map(escape).join(","), ...filas].join("\n");
    // BOM para que Excel respete los acentos.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `puestos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${items.length} puestos exportados.`);
  }, [lista.data]);

  const abrirNuevo = () => {
    setEditando(false);
    setFormAbierto(true);
  };

  const abrirEdicion = () => {
    if (!detalle.data) return;
    setEditando(true);
    setFormAbierto(true);
  };

  const irAMoviles = () => {
    router.push(
      seleccionadoId ? `/dashboard/moviles?puesto=${seleccionadoId}` : "/dashboard/moviles",
    );
  };

  const irAZonas = () => router.push("/dashboard/zonificacion");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Puestos"
        description="Administrá los puestos de venta de garrafas por departamento o zona operativa."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={abrirNuevo} className="gap-2">
              <Plus className="size-4" />
              Nuevo puesto
            </Button>
            <Button variant="outline" onClick={irAZonas} className="gap-2">
              <Layers className="size-4" />
              Ver zonas
            </Button>
            <Button variant="outline" onClick={irAMoviles} className="gap-2">
              <Truck className="size-4" />
              Ver móviles
            </Button>
            <Button variant="outline" onClick={exportar} className="gap-2">
              <FileSpreadsheet className="size-4" />
              Exportar Excel
            </Button>
          </div>
        }
      />

      <PuestosMetrics kpis={kpis.data} loading={kpis.isLoading} />

      <PuestosFilters
        valores={borrador}
        departamentos={departamentos}
        onChange={(parcial) => setBorrador((prev) => ({ ...prev, ...parcial }))}
        onAplicar={aplicar}
        onLimpiar={limpiar}
        hayFiltros={hayFiltros || borrador.search !== ""}
      />

      {lista.isError ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12">
            <EmptyState
              icon={Building2}
              title="No se pudieron cargar los puestos."
              description="Puede ser un problema momentáneo de conexión con el servidor."
              action={
                <Button variant="outline" onClick={() => lista.refetch()}>
                  Reintentar
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <PuestosTable
            data={lista.data}
            loading={lista.isLoading}
            seleccionadoId={seleccionadoId}
            onSeleccionar={(id) => setSeleccionadoId(id)}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            onLimpiarFiltros={limpiar}
            hayFiltros={hayFiltros}
          />

          <PuestoDetailPanel
            puesto={detalle.data}
            loading={seleccionadoId !== null && detalle.isLoading}
            error={detalle.isError}
            onEditar={abrirEdicion}
            onNuevo={abrirNuevo}
            onReintentar={() => detalle.refetch()}
            onVerMoviles={irAMoviles}
            onVerZonas={irAZonas}
          />
        </div>
      )}

      <PuestoFormDrawer
        open={formAbierto}
        onOpenChange={setFormAbierto}
        puesto={editando ? (detalle.data ?? null) : null}
        departamentos={departamentos}
        onGuardado={(id) => setSeleccionadoId(id)}
      />
    </div>
  );
}
