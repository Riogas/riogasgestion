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
}

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

export default function MapaZonificacion({
  zonas,
  onRename,
  onRemove,
  onEdit,
}: MapaZonificacionProps) {
  const mapRef = useRef<L.Map | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const [selectedZona, setSelectedZona] = useState<string | null>(null);
  const [renamingZona, setRenamingZona] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingZona, setEditingZona] = useState<string | null>(null);

  const defaultColor = "#1976d2";
  const editingColor = "#ff9800"; // naranja para zona en edición

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

  // Zonas que NO se están editando (se muestran como polígonos normales)
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

  // Renderizar polígonos NO editables (la mayoría)
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

  // Renderizar FeatureGroup editable (solo la zona seleccionada para edición + dibujo de nuevas)
  const renderEditableGroup = () => {
    return (
      <FeatureGroup ref={featureGroupRef}>
        {editingZonaData &&
          editingZonaData.coordinates?.map((polygon: [number, number][], index: number) => (
            <Polygon
              key={`edit-${editingZonaData.id}-${index}`}
              positions={polygon}
              color={editingColor}
              fillOpacity={0.5}
              weight={3}
              dashArray="5,8"
            >
              <Tooltip direction="top" offset={[0, -10]} sticky>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "#e65100" }}>
                  ✏️ {editingZonaData.name} (editando)
                </span>
              </Tooltip>
            </Polygon>
          ))}
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
            remove: true,
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
              setEditingZona(null);
            }
          }}
          onEdited={(e: any) => {
            if (!editingZona) return;
            e.layers.eachLayer((layer: any) => {
              const latlngs = layer.getLatLngs();
              const coords = [latlngs[0].map((latlng: any) => [latlng.lat, latlng.lng])];
              onEdit(editingZona, coords);
            });
            stopEditing();
          }}
          onDeleted={(e: any) => {
            if (editingZona) {
              onRemove(editingZona);
              stopEditing();
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
      style={{ height: "500px", width: "100%" }}
    >
      <FitBoundsOnZonas zonas={zonas} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {renderStaticPolygons()}
      {renderEditableGroup()}
      {editingZona && (
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
          <span>✏️ Editando: {editingZonaData?.name}</span>
          <button
            onClick={stopEditing}
            style={{
              background: "#ff9800",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Salir de edición
          </button>
        </div>
      )}
    </MapContainer>
  );
}
