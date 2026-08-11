"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import type { MapaMatch } from "@/lib/types/calleMatch";

/**
 * La evidencia visual del match: los puntos de la calle OSM (rojo) y la nube
 * de clientes del CALID (azul). Si la nube abraza la calle, el match es bueno;
 * si viven en barrios distintos, se ve al instante.
 */

function Encuadre({ datos }: { datos: MapaMatch }) {
  const map = useMap();
  useEffect(() => {
    const puntos: [number, number][] = [
      ...(datos.calleOsm?.puntos ?? []),
      ...datos.clientes,
    ];
    if (puntos.length === 0 && datos.calleOsm) {
      puntos.push([datos.calleOsm.lat, datos.calleOsm.lng]);
    }
    if (puntos.length > 0) {
      const lats = puntos.map((p) => p[0]);
      const lngs = puntos.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { padding: [30, 30], maxZoom: 16 },
      );
    }
  }, [datos, map]);
  return null;
}

export default function MatchMap({ datos }: { datos: MapaMatch }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const centro = useMemo<[number, number]>(
    () =>
      datos.calleOsm
        ? [datos.calleOsm.lat, datos.calleOsm.lng]
        : (datos.clientes[0] ?? [-34.88, -56.17]),
    [datos],
  );

  return (
    <MapContainer
      center={centro}
      zoom={15}
      className="h-full w-full rounded-lg"
      attributionControl={false}
    >
      <TileLayer
        url={`https://{s}.basemaps.cartocdn.com/${isDark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
      />
      <Encuadre datos={datos} />
      {(datos.calleOsm?.puntos ?? []).map(([lat, lng], i) => (
        <CircleMarker
          key={`osm-${i}`}
          center={[lat, lng]}
          radius={6}
          pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.9 }}
        >
          {i === 0 && datos.calleOsm && (
            <Tooltip permanent direction="top" offset={[0, -8]}>
              {datos.calleOsm.nombre}
            </Tooltip>
          )}
        </CircleMarker>
      ))}
      {datos.clientes.map(([lat, lng], i) => (
        <CircleMarker
          key={`cli-${i}`}
          center={[lat, lng]}
          radius={3}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.5,
            weight: 1,
          }}
        />
      ))}
    </MapContainer>
  );
}
