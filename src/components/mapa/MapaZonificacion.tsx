import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polygon,
  useMap,
  Popup,
  Tooltip,
  FeatureGroup,
} from "react-leaflet";
// @ts-ignore
import simplify from "@turf/simplify";
import { polygon as turfPolygon } from "@turf/helpers";
import { EditControl } from "react-leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Estilos personalizados para los handles de edición
const editHandleStyles = `
  .leaflet-editing-icon {
    width: 14px !important;
    height: 14px !important;
    margin-left: -7px !important;
    margin-top: -7px !important;
    border-radius: 50% !important;
    background: #ff9800 !important;
    border: 2.5px solid #fff !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4) !important;
    cursor: grab !important;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .leaflet-editing-icon:hover {
    transform: scale(1.4);
    box-shadow: 0 2px 8px rgba(255,152,0,0.6) !important;
    background: #f57c00 !important;
  }
  .leaflet-editing-icon:active {
    cursor: grabbing !important;
    transform: scale(1.2);
    background: #e65100 !important;
  }
  /* Puntos intermedios (para agregar nuevos vértices) */
  .leaflet-div-icon.leaflet-editing-icon {
    opacity: 0.6;
    width: 10px !important;
    height: 10px !important;
    margin-left: -5px !important;
    margin-top: -5px !important;
    background: #ffb74d !important;
    border: 2px solid #fff !important;
  }
  .leaflet-div-icon.leaflet-editing-icon:hover {
    opacity: 1;
    transform: scale(1.5);
  }
`;

interface LocalidadZona {
  id: string;
  name: string;
  coordinates: [number, number][][];
  color?: string;
  shouldSimplify?: boolean;
}

interface MapaZonificacionProps {
  zonas: LocalidadZona[];
  onRename: (id: string, newName: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, newCoords: [number, number][][]) => void;
  onChangeColor?: (id: string, color: string) => void;
}

const ZONE_COLORS = [
  { color: "#1976d2", name: "Azul" },
  { color: "#388e3c", name: "Verde" },
  { color: "#d32f2f", name: "Rojo" },
  { color: "#ff9800", name: "Naranja" },
  { color: "#7b1fa2", name: "Violeta" },
  { color: "#00796b", name: "Teal" },
  { color: "#c2185b", name: "Rosa" },
  { color: "#5d4037", name: "Marrón" },
  { color: "#455a64", name: "Gris" },
  { color: "#f57f17", name: "Amarillo" },
];

function FitBoundsOnZonas({ zonas }: { zonas: LocalidadZona[] }) {
  const map = useMap();

  useEffect(() => {
    if (zonas.length > 0) {
      const bounds = L.latLngBounds(zonas.flatMap((z) => z.coordinates?.flat() || []));
      if (bounds.isValid()) map.fitBounds(bounds);
    }
  }, [zonas, map]);

  return null;
}

// Simplificar coordenadas para edición (agrupar puntos muy pegados)
function simplifyForEditing(coordinates: [number, number][][]): [number, number][][] {
  try {
    const ring = coordinates[0];
    if (!ring || ring.length <= 20) return coordinates;

    // Tolerancia proporcional al tamaño del polígono
    const lats = ring.map(p => p[0]);
    const lngs = ring.map(p => p[1]);
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const size = Math.max(latRange, lngRange);
    // Tolerancia: ~1% del tamaño del polígono, mínimo 0.0003 (~30m)
    const tolerance = Math.max(size * 0.01, 0.0003);

    const turfCoords = coordinates.map(
      (r) => r.map(([lat, lng]) => [lng, lat])
    );
    const poly = turfPolygon(turfCoords);
    const simplified = simplify(poly, { tolerance, highQuality: true });
    const coords = simplified.geometry.coordinates.map(
      (r: any) => r.map(([lng, lat]: [number, number]) => [lat, lng])
    );
    if (!coords.length || !coords[0].length || coords[0].length < 4) return coordinates;
    return coords;
  } catch {
    return coordinates;
  }
}

// Componente que renderiza un polígono con edición de vértices activada inmediatamente
function EditablePolygon({
  zona,
  onSave,
  onCancel,
}: {
  zona: LocalidadZona;
  onSave: (id: string, newCoords: [number, number][][]) => void;
  onCancel: () => void;
}) {
  const polygonRef = useRef<L.Polygon | null>(null);
  const map = useMap();

  // Simplificar coordenadas para edición
  const editCoords = useMemo(
    () => simplifyForEditing(zona.coordinates),
    [zona.coordinates]
  );

  useEffect(() => {
    if (!polygonRef.current) return;
    const layer = polygonRef.current;
    if ((layer as any).editing) {
      (layer as any).editing.enable();
    }
    return () => {
      if ((layer as any).editing) {
        (layer as any).editing.disable();
      }
    };
  }, []);

  const handleSave = useCallback(() => {
    if (!polygonRef.current) return;
    const layer = polygonRef.current;
    const latlngs = layer.getLatLngs() as L.LatLng[][];
    const coords = [latlngs[0].map((ll: L.LatLng) => [ll.lat, ll.lng] as [number, number])];
    if ((layer as any).editing) {
      (layer as any).editing.disable();
    }
    onSave(zona.id, coords);
  }, [zona.id, onSave]);

  const handleCancel = useCallback(() => {
    if (polygonRef.current && (polygonRef.current as any).editing) {
      (polygonRef.current as any).editing.disable();
    }
    onCancel();
  }, [onCancel]);

  const pointCount = editCoords[0]?.length ?? 0;

  return (
    <>
      {editCoords.map((polygon: [number, number][], index: number) => (
        <Polygon
          key={`edit-${zona.id}-${index}`}
          ref={index === 0 ? polygonRef : undefined}
          positions={polygon}
          color="#ff9800"
          fillColor="#ff9800"
          fillOpacity={0.3}
          weight={3}
        >
          <Tooltip direction="top" offset={[0, -10]} sticky>
            <span style={{ fontWeight: 700, fontSize: "13px", color: "#e65100" }}>
              ✏️ {zona.name} ({pointCount} puntos)
            </span>
          </Tooltip>
        </Polygon>
      ))}
      <EditingControls
        zonaName={zona.name}
        pointCount={pointCount}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
}

// Controles flotantes para guardar/cancelar edición
function EditingControls({
  zonaName,
  pointCount,
  onSave,
  onCancel,
}: {
  zonaName: string;
  pointCount: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "#fff3e0",
        border: "2px solid #ff9800",
        borderRadius: 8,
        padding: "8px 16px",
        fontWeight: 600,
        fontSize: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span>✏️ {zonaName} — {pointCount} puntos</span>
      <button
        onClick={onSave}
        style={{
          background: "#4caf50",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "4px 12px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        ✓ Guardar
      </button>
      <button
        onClick={onCancel}
        style={{
          background: "#757575",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "4px 12px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Cancelar
      </button>
    </div>
  );
}

export default function MapaZonificacion({
  zonas,
  onRename,
  onRemove,
  onEdit,
  onChangeColor,
}: MapaZonificacionProps) {
  const mapRef = useRef<L.Map | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const [selectedZona, setSelectedZona] = useState<string | null>(null);
  const [renamingZona, setRenamingZona] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingZona, setEditingZona] = useState<string | null>(null);
  const [colorPickerZona, setColorPickerZona] = useState<string | null>(null);

  const defaultColor = "#1976d2";

  useEffect(() => {
    if (renamingZona) setSelectedZona(renamingZona);
  }, [renamingZona]);

  // Simplify polygons
  const simplifiedZonas = useMemo(() => {
    const tolerance = 0.0005;
    return zonas.map((zona) => {
      try {
        if (zona.shouldSimplify === false) return zona;
        const needsSimplify = zona.coordinates[0]?.length > 30;
        if (!needsSimplify) return zona;
        const turfCoords = zona.coordinates.map(
          (ring) => ring.map(([lat, lng]) => [lng, lat])
        );
        const poly = turfPolygon(turfCoords);
        const simplified = simplify(poly, { tolerance, highQuality: false });
        const coords = simplified.geometry.coordinates.map(
          (ring: any) => ring.map(([lng, lat]: [number, number]) => [lat, lng])
        );
        if (!coords.length || !coords[0].length) return zona;
        return { ...zona, coordinates: coords };
      } catch {
        return zona;
      }
    });
  }, [zonas]);

  // Zona que se está editando (solo una)
  const editingZonaData = useMemo(
    () => simplifiedZonas.find((z) => z.id === editingZona),
    [simplifiedZonas, editingZona]
  );

  // Zonas que NO se están editando
  const nonEditingZonas = useMemo(
    () => simplifiedZonas.filter((z) => z.id !== editingZona),
    [simplifiedZonas, editingZona]
  );

  const startEditing = useCallback((zonaId: string) => {
    setEditingZona(zonaId);
    setSelectedZona(null);
    setRenamingZona(null);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingZona(null);
  }, []);

  const handleEditSave = useCallback((id: string, newCoords: [number, number][][]) => {
    onEdit(id, newCoords);
    setEditingZona(null);
  }, [onEdit]);

  // Polígonos estáticos (no editables)
  const renderStaticPolygons = () => {
    return nonEditingZonas.map((zona) =>
      zona.coordinates?.map((polygon: [number, number][], index: number) => {
        const polygonColor = zona.color || defaultColor;
        return (
          <Polygon
            key={`static-${zona.id}-${index}`}
            positions={polygon}
            color={polygonColor}
            fillOpacity={editingZona ? 0.15 : 0.4}
            weight={editingZona ? 1 : 3}
            eventHandlers={{
              click: (e) => {
                if (!editingZona) {
                  setSelectedZona(zona.id);
                  L.DomEvent.stopPropagation(e);
                }
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} sticky>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "#222",
                  textShadow: "0 1px 3px #fff, 0 -1px 3px #fff, 1px 0 3px #fff, -1px 0 3px #fff",
                  padding: "2px 6px",
                }}
              >
                {zona.name}
              </span>
            </Tooltip>
            {selectedZona === zona.id && !editingZona && (
              <Popup
                position={polygon[0]}
                eventHandlers={{
                  remove: () => {
                    setSelectedZona(null);
                    setRenamingZona(null);
                  },
                }}
                autoPan={false}
              >
                {renamingZona === zona.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onRename(zona.id, renameValue);
                      setRenamingZona(null);
                    }}
                    className="flex flex-col gap-2"
                  >
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      className="border rounded px-2 py-1"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded">
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="bg-gray-300 px-2 py-1 rounded"
                        onClick={() => setRenamingZona(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : colorPickerZona === zona.id ? (
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    <div className="font-bold mb-1">Color: {zona.name}</div>
                    <div className="grid grid-cols-5 gap-1">
                      {ZONE_COLORS.map((c) => (
                        <button
                          key={c.color}
                          title={c.name}
                          onClick={() => {
                            onChangeColor?.(zona.id, c.color);
                            setColorPickerZona(null);
                            setSelectedZona(null);
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: c.color,
                            border: zona.color === c.color ? "3px solid #222" : "2px solid #ccc",
                            cursor: "pointer",
                            transition: "transform 0.1s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        />
                      ))}
                    </div>
                    <button
                      className="bg-gray-300 px-2 py-1 rounded text-sm"
                      onClick={() => setColorPickerZona(null)}
                    >
                      Volver
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <div className="font-bold mb-1">{zona.name}</div>
                    <button
                      className="bg-orange-500 text-white px-2 py-1 rounded"
                      onClick={() => startEditing(zona.id)}
                    >
                      ✏️ Editar puntos
                    </button>
                    <button
                      className="bg-blue-600 text-white px-2 py-1 rounded"
                      onClick={() => {
                        setRenamingZona(zona.id);
                        setRenameValue(zona.name);
                      }}
                    >
                      Renombrar
                    </button>
                    <button
                      className="text-white px-2 py-1 rounded"
                      style={{ background: zona.color || defaultColor }}
                      onClick={() => setColorPickerZona(zona.id)}
                    >
                      🎨 Cambiar color
                    </button>
                    <button
                      className="bg-red-600 text-white px-2 py-1 rounded"
                      onClick={() => onRemove(zona.id)}
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </Popup>
            )}
          </Polygon>
        );
      })
    );
  };

  // FeatureGroup solo para dibujar polígonos NUEVOS
  const renderDrawGroup = () => {
    if (editingZona) return null; // No mostrar herramientas de dibujo mientras se edita
    return (
      <FeatureGroup ref={featureGroupRef}>
        <EditControl
          position="topright"
          draw={{
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false,
            polygon: true,
          }}
          edit={{
            featureGroup: featureGroupRef.current ?? undefined,
            edit: false,
            remove: false,
          }}
          onCreated={(e: any) => {
            if (e.layerType === "polygon") {
              const layer = e.layer;
              const latlngs = layer.getLatLngs();
              const coords = [latlngs[0].map((latlng: any) => [latlng.lat, latlng.lng])];
              const newId = `custom-${Date.now()}`;
              onEdit(newId, coords);
              setRenamingZona(newId);
              setRenameValue("Nueva zona");
              // Quitar el layer dibujado (ya se agrega via zonas prop)
              featureGroupRef.current?.removeLayer(layer);
            }
          }}
        />
      </FeatureGroup>
    );
  };

  return (
    <MapContainer
      ref={mapRef}
      center={[-33.0, -56.0]}
      zoom={7}
      doubleClickZoom={false}
      style={{ height: "500px", width: "100%" }}
    >
      <style>{editHandleStyles}</style>
      <FitBoundsOnZonas zonas={zonas} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {renderStaticPolygons()}
      {renderDrawGroup()}
      {editingZonaData && (
        <EditablePolygon
          key={`editable-${editingZonaData.id}`}
          zona={editingZonaData}
          onSave={handleEditSave}
          onCancel={stopEditing}
        />
      )}
    </MapContainer>
  );
}
