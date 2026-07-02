"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-draw"; // extiende L con L.Draw
import {
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { useTheme } from "next-themes";
import {
  Check,
  Hand,
  Layers,
  Maximize,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { URUGUAY_CENTER, type LatLng, type Puesto, type Zone } from "@/lib/types/zona";
import { MapLegend } from "./MapLegend";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type MapTool = "select" | "draw" | "pan";

export interface MapLayersState {
  zones: boolean;
  labels: boolean;
  archived: boolean;
}

// ─── Estilos custom (labels de zona, handles de edición, fondo dark) ─────────

const mapStyles = `
  .zonif-map.leaflet-container {
    background: #dfe5ee;
    font-family: inherit;
    outline: none;
  }
  .dark .zonif-map.leaflet-container {
    background: #0b1220;
  }
  .zone-label {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .zone-label::before {
    display: none !important;
  }
  .zonif-map .leaflet-editing-icon {
    width: 12px !important;
    height: 12px !important;
    margin-left: -6px !important;
    margin-top: -6px !important;
    border-radius: 9999px !important;
    background: #e5edf7 !important;
    border: 2px solid #2878ff !important;
    box-shadow: 0 1px 4px rgba(0,0,0,.5) !important;
    cursor: grab !important;
  }
  .zonif-map .leaflet-editing-icon:hover {
    transform: scale(1.3);
  }
  .zonif-draw-handle {
    border-radius: 9999px;
    background: #e5edf7;
    border: 2px solid #2878ff;
    box-shadow: 0 1px 4px rgba(0,0,0,.5);
    cursor: grab;
  }
  .zonif-draw-handle:hover {
    transform: scale(1.25);
  }
  .zonif-draw-first {
    background: #2878ff;
    border-color: #e5edf7;
    cursor: pointer;
  }
  .zonif-map .leaflet-draw-tooltip {
    background: #0f172a;
    border: 1px solid #1e293b;
    color: #e5edf7;
  }
  .zonif-map .leaflet-draw-tooltip:before {
    border-right-color: #1e293b;
  }
  .zonif-map .leaflet-control-attribution {
    background: rgba(11, 18, 32, .7);
    color: #64748b;
  }
  .zonif-map .leaflet-control-attribution a {
    color: #94a3b8;
  }
`;

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toLatLngTuples(polygon: LatLng[]): [number, number][] {
  return polygon.map((p) => [p.lat, p.lng]);
}

function polygonCenter(polygon: LatLng[]): [number, number] {
  const b = L.latLngBounds(toLatLngTuples(polygon));
  const c = b.getCenter();
  return [c.lat, c.lng];
}

// ─── Sub-componentes de mapa ──────────────────────────────────────────────────

// Vuela al puesto cuando cambia. Si el puesto no tiene coordenadas (ej.
// Montevideo id 100) o se eligió "Todos", centra en las zonas apenas llegan.
function FlyToPuesto({
  puesto,
  zones,
  focusKey,
}: {
  puesto: Puesto | null;
  zones: Zone[];
  focusKey: string;
}) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);
  const pendingZonesFit = useRef(false);

  useEffect(() => {
    if (focusKey === lastKey.current) return;
    lastKey.current = focusKey;
    if (puesto && puesto.lat != null && puesto.lng != null) {
      pendingZonesFit.current = false;
      map.flyTo([puesto.lat, puesto.lng], 12, { duration: 0.8 });
    } else {
      pendingZonesFit.current = true; // esperar a que carguen las zonas
    }
  }, [focusKey, puesto, map]);

  useEffect(() => {
    if (!pendingZonesFit.current || zones.length === 0) return;
    const bounds = L.latLngBounds(
      zones.flatMap((z) => toLatLngTuples(z.polygon)),
    );
    if (bounds.isValid()) {
      pendingZonesFit.current = false;
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 });
    }
  }, [zones, map]);

  return null;
}

// Centra la zona seleccionada.
function FlyToZone({ zone }: { zone: Zone | null }) {
  const map = useMap();
  const lastId = useRef<number | null>(null);
  useEffect(() => {
    if (!zone) {
      lastId.current = null;
      return;
    }
    if (zone.id === lastId.current) return;
    lastId.current = zone.id;
    const bounds = L.latLngBounds(toLatLngTuples(zone.polygon));
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [60, 60], duration: 0.6 });
  }, [zone, map]);
  return null;
}

// Herramienta de dibujo propia (click = vértice; click en el 1er punto o
// doble click = cerrar; arrastrar un vértice lo corrige; click derecho lo
// borra). No usa L.Draw.Polygon: leaflet-draw tiene un bug conocido en
// equipos con pantalla táctil (modo leaflet-touch) donde los clicks del
// mouse no agregan vértices.
function DrawController({
  drawing,
  points,
  onAddPoint,
  onMovePoint,
  onRemovePoint,
  onFinish,
}: {
  drawing: boolean;
  points: LatLng[];
  onAddPoint: (p: LatLng) => void;
  onMovePoint: (index: number, p: LatLng) => void;
  onRemovePoint: (index: number) => void;
  onFinish: () => void;
}) {
  const map = useMap();
  const stateRef = useRef({ points, onAddPoint, onFinish });
  stateRef.current = { points, onAddPoint, onFinish };
  // Al soltar el drag de un vértice, el browser dispara un click que llega al
  // mapa y agregaba un punto fantasma: se ignoran clicks pegados a un dragend.
  const lastDragEnd = useRef(0);

  useEffect(() => {
    if (!drawing) return;

    const container = map.getContainer();
    container.style.cursor = "crosshair";

    const onClick = (e: L.LeafletMouseEvent) => {
      if (Date.now() - lastDragEnd.current < 300) return;
      stateRef.current.onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    const onDblClick = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e as any);
      if (stateRef.current.points.length >= 3) stateRef.current.onFinish();
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      container.style.cursor = "";
    };
  }, [drawing, map]);

  if (!drawing || points.length === 0) return null;

  return (
    <>
      {points.length >= 2 && (
        <Polygon
          positions={toLatLngTuples(points)}
          interactive={false}
          pathOptions={{
            color: "#2878ff",
            weight: 2,
            fillColor: "#2878ff",
            fillOpacity: 0.15,
            dashArray: "6 4",
          }}
        />
      )}
      {points.map((p, i) => (
        <Marker
          key={i}
          position={[p.lat, p.lng]}
          draggable
          // sin bubbling: el click que cierra un drag no debe llegar al mapa
          // (agregaba un punto fantasma al soltar el arrastre)
          bubblingMouseEvents={false}
          icon={L.divIcon({
            className: `zonif-draw-handle${i === 0 ? " zonif-draw-first" : ""}`,
            iconSize: i === 0 ? [16, 16] : [12, 12],
            iconAnchor: i === 0 ? [8, 8] : [6, 6],
          })}
          eventHandlers={{
            dragend: (e) => {
              lastDragEnd.current = Date.now();
              const ll = (e.target as L.Marker).getLatLng();
              onMovePoint(i, { lat: ll.lat, lng: ll.lng });
            },
            contextmenu: (e) => {
              L.DomEvent.stopPropagation(e as any);
              onRemovePoint(i);
            },
            click: (e: L.LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(e as any);
              // click en el primer punto cierra el polígono
              if (i === 0 && stateRef.current.points.length >= 3) {
                stateRef.current.onFinish();
              }
            },
          }}
        />
      ))}
    </>
  );
}

// Polígono con edición de vértices activa (leaflet-draw editing).
function EditableZonePolygon({
  zone,
  onRegisterGetter,
}: {
  zone: Zone;
  // registra un getter para leer las coordenadas actuales al guardar
  onRegisterGetter: (getter: () => LatLng[]) => void;
}) {
  const ref = useRef<L.Polygon | null>(null);

  useEffect(() => {
    const layer = ref.current as any;
    if (!layer?.editing) return;
    layer.editing.enable();
    onRegisterGetter(() => {
      const latlngs = layer.getLatLngs() as L.LatLng[][];
      return latlngs[0].map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }));
    });
    return () => layer.editing?.disable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.id]);

  return (
    <Polygon
      ref={ref as any}
      positions={toLatLngTuples(zone.polygon)}
      pathOptions={{
        color: zone.color,
        weight: 3,
        fillColor: zone.color,
        fillOpacity: 0.35,
        dashArray: "6 4",
      }}
    />
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface ZoneMapProps {
  zones: Zone[]; // ya filtradas (incluye archivadas si la capa está activa)
  puesto: Puesto | null;
  selectedId: number | null;
  drawing: boolean;
  draftPolygon: LatLng[] | null;
  editingZone: Zone | null;
  tool: MapTool;
  layers: MapLayersState;
  onToolChange: (t: MapTool) => void;
  onLayersChange: (l: MapLayersState) => void;
  onSelect: (id: number) => void;
  onEditGeometry: (id: number) => void;
  onDrawComplete: (polygon: LatLng[]) => void;
  onCancelDraw: () => void;
  onGeometrySave: (polygon: LatLng[]) => void;
  onGeometryCancel: () => void;
}

export function ZoneMap({
  zones,
  puesto,
  selectedId,
  drawing,
  draftPolygon,
  editingZone,
  tool,
  layers,
  onToolChange,
  onLayersChange,
  onSelect,
  onEditGeometry,
  onDrawComplete,
  onCancelDraw,
  onGeometrySave,
  onGeometryCancel,
}: ZoneMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const geometryGetter = useRef<(() => LatLng[]) | null>(null);
  const [drawPoints, setDrawPoints] = useState<LatLng[]>([]);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light"; // default dark (estilo del dashboard)

  // Limpiar el borrador de puntos al salir del modo dibujo.
  useEffect(() => {
    if (!drawing) setDrawPoints([]);
  }, [drawing]);

  const finishDraw = () => {
    if (drawPoints.length < 3) return;
    onDrawComplete(drawPoints);
    setDrawPoints([]);
  };

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedId) ?? null,
    [zones, selectedId],
  );

  const staticZones = useMemo(
    () => (editingZone ? zones.filter((z) => z.id !== editingZone.id) : zones),
    [zones, editingZone],
  );

  const interactive = tool !== "pan" && !drawing && !editingZone;

  const centerAll = () => {
    if (!map) return;
    const pts = zones.flatMap((z) => toLatLngTuples(z.polygon));
    if (pts.length) {
      const b = L.latLngBounds(pts);
      if (b.isValid()) {
        map.fitBounds(b, { padding: [40, 40] });
        return;
      }
    }
    if (puesto && puesto.lat != null && puesto.lng != null) {
      map.setView([puesto.lat, puesto.lng], 12);
    }
  };

  const toolBtn = (t: MapTool, Icon: typeof MousePointer2, label: string) => (
    <Button
      key={t}
      variant={tool === t ? "default" : "ghost"}
      size="icon"
      className="size-8"
      title={label}
      aria-label={label}
      onClick={() => {
        if (t === "draw") onToolChange("draw");
        else onToolChange(t);
      }}
    >
      <Icon className="size-4" />
    </Button>
  );

  return (
    <Card className="relative h-full gap-0 overflow-hidden p-0">
      <style>{mapStyles}</style>

      <MapContainer
        ref={setMap as any}
        center={
          puesto && puesto.lat != null && puesto.lng != null
            ? ([puesto.lat, puesto.lng] as [number, number])
            : ([URUGUAY_CENTER.lat, URUGUAY_CENTER.lng] as [number, number])
        }
        zoom={puesto?.lat != null ? 12 : 7}
        zoomControl={false}
        doubleClickZoom={false}
        className="zonif-map h-full min-h-[560px] w-full"
      >
        <TileLayer
          key={isDark ? "dark" : "light"}
          url={`https://{s}.basemaps.cartocdn.com/${isDark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        <FlyToPuesto
          puesto={puesto}
          zones={zones}
          focusKey={puesto ? String(puesto.id) : "all"}
        />
        <FlyToZone zone={selectedZone} />
        <DrawController
          drawing={drawing}
          points={drawPoints}
          onAddPoint={(p) => setDrawPoints((prev) => [...prev, p])}
          onMovePoint={(i, p) =>
            setDrawPoints((prev) => prev.map((x, j) => (j === i ? p : x)))
          }
          onRemovePoint={(i) =>
            setDrawPoints((prev) => prev.filter((_, j) => j !== i))
          }
          onFinish={finishDraw}
        />

        {layers.zones &&
          staticZones.map((zone) => {
            const isSelected = zone.id === selectedId;
            const archived = zone.status === "ARCHIVED";
            return (
              <Polygon
                // `interactive` en la key: react-leaflet no actualiza esa opción
                // en caliente; remontar el layer evita que los polígonos se
                // traguen los clicks durante el dibujo de una zona nueva.
                key={`${zone.id}-${interactive}`}
                positions={toLatLngTuples(zone.polygon)}
                interactive={interactive}
                pathOptions={{
                  color: zone.color,
                  weight: isSelected ? 3.5 : 2,
                  opacity: archived ? 0.5 : 1,
                  fillColor: zone.color,
                  fillOpacity: archived ? 0.08 : isSelected ? 0.4 : 0.25,
                  dashArray: archived ? "4 6" : undefined,
                }}
                eventHandlers={{
                  click: (e) => {
                    if (!interactive) return; // no robar clicks al dibujo
                    L.DomEvent.stopPropagation(e as any);
                    onSelect(zone.id);
                  },
                  dblclick: (e) => {
                    if (!interactive) return;
                    L.DomEvent.stopPropagation(e as any);
                    if (!archived) onEditGeometry(zone.id);
                  },
                  mouseover: (e) => {
                    (e.target as L.Polygon).setStyle({
                      weight: 4,
                      fillOpacity: archived ? 0.15 : 0.45,
                    });
                  },
                  mouseout: (e) => {
                    (e.target as L.Polygon).setStyle({
                      weight: isSelected ? 3.5 : 2,
                      fillOpacity: archived ? 0.08 : isSelected ? 0.4 : 0.25,
                    });
                  },
                }}
              >
                {layers.labels && (
                  <Tooltip
                    permanent
                    direction="center"
                    className="zone-label"
                    position={polygonCenter(zone.polygon)}
                  >
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm"
                      style={{
                        backgroundColor: hexToRgba(zone.color, 0.28),
                        border: `1px solid ${hexToRgba(zone.color, 0.9)}`,
                        color: isDark ? "#e5edf7" : "#0f172a",
                        backdropFilter: "blur(2px)",
                      }}
                    >
                      {zone.name}
                    </span>
                  </Tooltip>
                )}
              </Polygon>
            );
          })}

        {/* Polígono recién dibujado (borrador de la nueva zona) */}
        {draftPolygon && draftPolygon.length >= 3 && (
          <Polygon
            positions={toLatLngTuples(draftPolygon)}
            pathOptions={{
              color: "#2878ff",
              weight: 2.5,
              fillColor: "#2878ff",
              fillOpacity: 0.2,
              dashArray: "6 4",
            }}
          />
        )}

        {/* Zona en edición de geometría (vértices arrastrables) */}
        {editingZone && (
          <EditableZonePolygon
            key={editingZone.id}
            zone={editingZone}
            onRegisterGetter={(g) => {
              geometryGetter.current = g;
            }}
          />
        )}
      </MapContainer>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}

      {/* Vista (herramientas) + zoom — arriba izquierda */}
      <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex flex-col gap-2">
        <div className="pointer-events-auto rounded-xl border border-border bg-card/90 p-1.5 shadow-md backdrop-blur">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Vista
          </p>
          <div className="flex items-center gap-1">
            {toolBtn("select", MousePointer2, "Seleccionar")}
            {toolBtn("draw", PenLine, "Dibujar polígono")}
            {toolBtn("pan", Hand, "Mover mapa")}
          </div>
        </div>
        <div className="pointer-events-auto flex w-fit flex-col overflow-hidden rounded-xl border border-border bg-card/90 shadow-md backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-none"
            aria-label="Acercar"
            onClick={() => map?.zoomIn()}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-none border-y border-border/60"
            aria-label="Alejar"
            onClick={() => map?.zoomOut()}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-none"
            aria-label="Centrar vista"
            onClick={centerAll}
          >
            <Maximize className="size-4" />
          </Button>
        </div>
      </div>

      {/* Capas — arriba derecha */}
      <div className="absolute right-3 top-3 z-[1000]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-card/90 shadow-md backdrop-blur"
            >
              <Layers className="size-4" />
              Capas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[1100]">
            <DropdownMenuLabel>Capas del mapa</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={layers.zones}
              onCheckedChange={(v) =>
                onLayersChange({ ...layers, zones: v === true })
              }
            >
              Zonas activas
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={layers.archived}
              onCheckedChange={(v) =>
                onLayersChange({ ...layers, archived: v === true })
              }
            >
              Zonas archivadas
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={layers.labels}
              onCheckedChange={(v) =>
                onLayersChange({ ...layers, labels: v === true })
              }
            >
              Etiquetas
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={false} disabled>
              Móviles (próximamente)
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={false} disabled>
              Puestos (próximamente)
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Aviso: dibujando nueva zona */}
      {drawing && (
        <div className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
          <div className="flex w-max max-w-[90vw] items-center gap-3 rounded-xl border border-primary/50 bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
            <PenLine className="size-4 shrink-0 text-primary" />
            <span className="whitespace-nowrap text-sm text-foreground">
              {drawPoints.length === 0
                ? "Dibujá los puntos de la nueva zona sobre el mapa."
                : `${drawPoints.length} punto${drawPoints.length === 1 ? "" : "s"} · arrastrá para corregir · click derecho borra`}
            </span>
            {drawPoints.length >= 3 && (
              <Button size="sm" onClick={finishDraw}>
                <Check className="size-4" />
                Finalizar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onCancelDraw}>
              <X className="size-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Aviso: editando geometría */}
      {editingZone && (
        <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-warn/50 bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
            <span className="text-sm text-foreground">
              Mové los puntos del polígono y guardá los cambios.
            </span>
            <Button variant="outline" size="sm" onClick={onGeometryCancel}>
              Cancelar edición
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const polygon = geometryGetter.current?.();
                if (polygon && polygon.length >= 3) onGeometrySave(polygon);
              }}
            >
              <Check className="size-4" />
              Guardar cambios
            </Button>
          </div>
        </div>
      )}

      {/* Leyenda — abajo izquierda */}
      <div className="pointer-events-none absolute bottom-4 left-3 z-[1000]">
        <MapLegend />
      </div>
    </Card>
  );
}
