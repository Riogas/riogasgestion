"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import type { CalleOsmDetalle, MapaMatch } from "@/lib/types/calleMatch";

/**
 * La evidencia visual del match: los puntos de la calle OSM (rojo), la nube
 * de clientes del CALID (azul) y — durante una corrección — la candidata que
 * se está por elegir (naranja). Si la nube abraza la naranja, es esa.
 */

function Encuadre({
  datos,
  candidata,
}: {
  datos: MapaMatch;
  candidata: CalleOsmDetalle | null;
}) {
  const map = useMap();
  useEffect(() => {
    const puntos: [number, number][] = [
      ...(datos.calleOsm?.puntos ?? []),
      ...datos.clientes.map((c) => [c.lat, c.lng] as [number, number]),
      ...(candidata?.puntos ?? []),
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
  }, [datos, candidata, map]);
  return null;
}

export default function MatchMap({
  datos,
  candidata = null,
}: {
  datos: MapaMatch;
  candidata?: CalleOsmDetalle | null;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const centro = useMemo<[number, number]>(
    () =>
      datos.calleOsm
        ? [datos.calleOsm.lat, datos.calleOsm.lng]
        : datos.clientes[0]
          ? [datos.clientes[0].lat, datos.clientes[0].lng]
          : [-34.88, -56.17],
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
      <Encuadre datos={datos} candidata={candidata} />
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
      {(candidata?.puntos ?? []).map(([lat, lng], i) => (
        <CircleMarker
          key={`cand-${i}`}
          center={[lat, lng]}
          radius={6}
          pathOptions={{ color: "#ea580c", fillColor: "#f97316", fillOpacity: 0.95 }}
        >
          {i === 0 && candidata && (
            <Tooltip permanent direction="bottom" offset={[0, 8]}>
              → {candidata.nombre}
            </Tooltip>
          )}
        </CircleMarker>
      ))}
      {datos.clientes.map((c) => (
        <CircleMarker
          key={`cli-${c.id}`}
          center={[c.lat, c.lng]}
          radius={4}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.5,
            weight: 1,
          }}
        >
          {/* Identidad del punto: con CLIID + CALID se rastrea en la base. */}
          <Tooltip direction="top" offset={[0, -6]}>
            <div className="text-xs">
              <div className="font-semibold">{c.nombre ?? "(sin nombre)"}</div>
              <div>
                CLIID {c.id} · CALID {datos.calid}
              </div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
