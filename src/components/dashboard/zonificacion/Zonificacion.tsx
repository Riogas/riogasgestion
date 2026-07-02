"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { toast } from "sonner";
import { usePuestos, useZones, useZoneMutations } from "@/hooks/zonas";
import type {
  LatLng,
  ServiceType,
  Zone,
  ZoneType,
} from "@/lib/types/zona";
import { ZoneFilters } from "./ZoneFilters";
import { ZoneListPanel } from "./ZoneListPanel";
import { ZoneMap, type MapLayersState, type MapTool } from "./ZoneMap";
import { ZoneEditorPanel, type ZoneFormValues } from "./ZoneEditorPanel";
import { DeleteZoneDialog } from "./DeleteZoneDialog";

// Búsqueda insensible a mayúsculas y tildes.
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function Zonificacion() {
  // ── Filtros (URL state, mismo patrón que Móviles) ──────────────────────────
  const [puestoIdParam, setPuestoIdParam] = useQueryState(
    "puesto",
    parseAsInteger.withDefault(0), // 0 = sin elegir → se resuelve al cargar puestos
  );
  const [zoneType, setZoneType] = useQueryState(
    "tz",
    parseAsString.withDefault(""),
  );
  const [service, setService] = useQueryState(
    "srv",
    parseAsString.withDefault(""),
  );
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [selectedId, setSelectedId] = useQueryState("sel", parseAsInteger);

  // ── Estado de interacción ──────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [draftPolygon, setDraftPolygon] = useState<LatLng[] | null>(null);
  const [editingGeometryId, setEditingGeometryId] = useState<number | null>(
    null,
  );
  const [tool, setTool] = useState<MapTool>("select");
  const [layers, setLayers] = useState<MapLayersState>({
    zones: true,
    labels: true,
    archived: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);

  // ── Datos ──────────────────────────────────────────────────────────────────
  const { data: puestos = [] } = usePuestos();

  // Sin puesto en la URL: por defecto el primero con espejo en track
  // (Montevideo) o, si no hay, el primero de la lista.
  const puestoId =
    puestoIdParam > 0
      ? puestoIdParam
      : (puestos.find((p) => p.escenarioId != null) ?? puestos[0])?.id ?? null;

  const { data: zones = [], isLoading } = useZones(puestoId);
  const { create, update, remove, duplicate } = useZoneMutations(puestoId);

  const puesto = puestos.find((p) => p.id === puestoId) ?? null;

  // Zonas visibles según capas + filtros.
  const visibleZones = useMemo(() => {
    const q = normalize(search.trim());
    return zones.filter((z) => {
      if (z.status === "ARCHIVED" && !layers.archived) return false;
      if (zoneType && z.zoneType !== zoneType) return false;
      if (service && !z.services.includes(service as ServiceType)) return false;
      if (q && !normalize(z.name).includes(q)) return false;
      return true;
    });
  }, [zones, layers.archived, zoneType, service, search]);

  const selectedZone = useMemo(
    () => visibleZones.find((z) => z.id === selectedId) ?? null,
    [visibleZones, selectedId],
  );

  const editingZone = useMemo(
    () => zones.find((z) => z.id === editingGeometryId) ?? null,
    [zones, editingGeometryId],
  );

  // Si la zona seleccionada dejó de ser visible (cambio de puesto/filtros),
  // limpiar selección.
  useEffect(() => {
    if (
      selectedId != null &&
      !isLoading &&
      zones.length >= 0 &&
      !visibleZones.some((z) => z.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [selectedId, visibleZones, isLoading, zones.length, setSelectedId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetInteraction = () => {
    setCreating(false);
    setDraftPolygon(null);
    setEditingGeometryId(null);
    setTool("select");
  };

  const handlePuestoChange = (id: number) => {
    setPuestoIdParam(id);
    setSelectedId(null);
    resetInteraction();
  };

  const clearFilters = () => {
    setZoneType("");
    setService("");
    setSearch("");
  };

  const startCreate = () => {
    setCreating(true);
    setDraftPolygon(null);
    setSelectedId(null);
    setEditingGeometryId(null);
    setTool("draw");
  };

  const cancelCreate = () => {
    setCreating(false);
    setDraftPolygon(null);
    setTool("select");
  };

  const handleToolChange = (t: MapTool) => {
    if (t === "draw") {
      // Dibujar = crear zona nueva (o re-dibujar el borrador actual).
      if (!creating) startCreate();
      else setDraftPolygon(null);
      setTool("draw");
      return;
    }
    setTool(t);
  };

  const handleDrawComplete = (polygon: LatLng[]) => {
    setDraftPolygon(polygon);
    setTool("select");
    toast.info(
      `Polígono listo (${polygon.length} puntos). Completá los datos de la zona.`,
    );
  };

  const handleSelect = (id: number) => {
    if (creating) return; // no perder el borrador por un click accidental
    setEditingGeometryId(null);
    setSelectedId(id);
  };

  const handleEditGeometry = (id: number) => {
    if (creating) return;
    setSelectedId(id);
    setEditingGeometryId(id);
    setTool("select");
  };

  const handleGeometrySave = async (polygon: LatLng[]) => {
    if (editingGeometryId == null) return;
    try {
      await update.mutateAsync({ id: editingGeometryId, patch: { polygon } });
      toast.success("Polígono actualizado.");
    } catch {
      toast.error("Error al guardar el polígono.");
    } finally {
      setEditingGeometryId(null);
    }
  };

  const handleSave = async (values: ZoneFormValues) => {
    if (puestoId == null) return;
    try {
      if (creating) {
        if (!draftPolygon || draftPolygon.length < 3) return;
        const created = await create.mutateAsync({
          ...values,
          puestoId,
          status: "ACTIVE",
          polygon: draftPolygon,
        });
        setCreating(false);
        setDraftPolygon(null);
        setSelectedId(created.id);
        toast.success("Zona guardada correctamente.");
      } else if (selectedZone) {
        await update.mutateAsync({ id: selectedZone.id, patch: values });
        toast.success("Zona guardada correctamente.");
      }
    } catch {
      toast.error("Error al guardar la zona.");
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const copy = await duplicate.mutateAsync(id);
      setSelectedId(copy.id);
      toast.success("Zona duplicada.");
    } catch {
      toast.error("Error al duplicar la zona.");
    }
  };

  const handleArchiveToggle = async (zone: Zone) => {
    const archiving = zone.status === "ACTIVE";
    try {
      await update.mutateAsync({
        id: zone.id,
        patch: { status: archiving ? "ARCHIVED" : "ACTIVE" },
      });
      toast.success(archiving ? "Zona archivada." : "Zona restaurada.");
    } catch {
      toast.error("Error al actualizar la zona.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      toast.success("Zona eliminada.");
    } catch {
      toast.error("Error al eliminar la zona.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const saving = create.isPending || update.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Breadcrumb + título */}
      <div className="min-w-0">
        <nav className="text-xs text-muted-foreground">
          Inicio <span className="px-1">/</span> Administración{" "}
          <span className="px-1">/</span>{" "}
          <span className="text-foreground">Zonificación</span>
        </nav>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Zonificación
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestioná las zonas operativas de cada puesto. Creá, editá y
          clasificá tus zonas en el mapa.
        </p>
      </div>

      {/* Filtros */}
      <ZoneFilters
        puestos={puestos}
        puestoId={puestoId}
        zoneType={zoneType as ZoneType | ""}
        service={service as ServiceType | ""}
        search={search}
        creating={creating}
        onPuestoChange={handlePuestoChange}
        onZoneTypeChange={(v) => setZoneType(v)}
        onServiceChange={(v) => setService(v)}
        onSearchChange={setSearch}
        onClear={clearFilters}
        onNewZone={startCreate}
      />

      {/* Lista + mapa + editor */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px] xl:h-[660px]">
        <div className="h-full min-h-0 max-lg:order-2">
          <ZoneListPanel
            zones={visibleZones}
            isLoading={isLoading}
            selectedId={selectedId ?? null}
            showArchived={layers.archived}
            onToggleArchived={() =>
              setLayers((l) => ({ ...l, archived: !l.archived }))
            }
            onSelect={handleSelect}
            onEditGeometry={handleEditGeometry}
            onDuplicate={handleDuplicate}
            onArchiveToggle={handleArchiveToggle}
            onDelete={setDeleteTarget}
            onNewZone={startCreate}
          />
        </div>

        <div className="h-full min-h-0 max-lg:order-1">
          <ZoneMap
            zones={visibleZones}
            puesto={puesto}
            selectedId={selectedId ?? null}
            drawing={creating && draftPolygon === null}
            draftPolygon={draftPolygon}
            editingZone={editingZone}
            tool={tool}
            layers={layers}
            onToolChange={handleToolChange}
            onLayersChange={setLayers}
            onSelect={handleSelect}
            onEditGeometry={handleEditGeometry}
            onDrawComplete={handleDrawComplete}
            onCancelDraw={cancelCreate}
            onGeometrySave={handleGeometrySave}
            onGeometryCancel={() => setEditingGeometryId(null)}
          />
        </div>

        <div className="h-full min-h-0 overflow-y-auto max-lg:order-3 lg:col-span-2 xl:col-span-1">
          <ZoneEditorPanel
            zone={creating ? null : selectedZone}
            creating={creating}
            draftPoints={draftPolygon?.length ?? 0}
            saving={saving}
            onSave={handleSave}
            onDelete={() => selectedZone && setDeleteTarget(selectedZone)}
            onClose={() => setSelectedId(null)}
            onCancelCreate={cancelCreate}
            onEditGeometry={() =>
              selectedZone && handleEditGeometry(selectedZone.id)
            }
            onNewZone={startCreate}
          />
        </div>
      </div>

      <DeleteZoneDialog
        zone={deleteTarget}
        deleting={remove.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
