"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  nombre?: string | null;
  direccion?: string | null;
}

/** Pin azul inline: evita depender de los iconos PNG de Leaflet, que con el
 *  bundler de Next quedan con la ruta rota y no se ven. */
const PIN = L.divIcon({
  className: "",
  html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.2 13 21 13 21s13-11.8 13-21c0-7.2-5.8-13-13-13z" fill="#2878FF"/>
    <circle cx="13" cy="13" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -30],
});

export default function PuestoMapPreviewInner({ lat, lng, nombre, direccion }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const m = L.map(contenedor.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false, // el mapa vive dentro de un panel con scroll propio
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(m);

    const marcador = L.marker([lat, lng], { icon: PIN }).addTo(m);
    const titulo = nombre ?? "Puesto";
    marcador.bindTooltip(
      direccion ? `<strong>${titulo}</strong><br/>${direccion}` : `<strong>${titulo}</strong>`,
      { permanent: true, direction: "top", offset: [0, -30] },
    );

    mapa.current = m;

    return () => {
      m.remove();
      mapa.current = null;
    };
  }, [lat, lng, nombre, direccion]);

  // Recentrar sin re-montar cuando cambia el puesto seleccionado.
  useEffect(() => {
    mapa.current?.setView([lat, lng], 14);
  }, [lat, lng]);

  return (
    <div
      ref={contenedor}
      className="h-[150px] w-full overflow-hidden rounded-xl border border-border [&_.leaflet-container]:bg-muted"
      role="img"
      aria-label={`Ubicación de ${nombre ?? "el puesto"} en el mapa`}
    />
  );
}
