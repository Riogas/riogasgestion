"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapaDireccionPin {
  lat: number | null;
  lng: number | null;
}

export interface MapaDireccionesProps {
  direcciones: MapaDireccionPin[];
  activeIndex: number;
  onPinMove?: (idx: number, lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

// Montevideo como centro por defecto.
const DEFAULT_CENTER: [number, number] = [-34.9011, -56.1645];

function numberedIcon(n: number, active: boolean): L.DivIcon {
  const bg = active ? "#2563eb" : "#64748b";
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};color:#fff;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function MapaDireccionesInner({
  direcciones,
  activeIndex,
  onPinMove,
  onMapClick,
}: MapaDireccionesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const onMapClickRef = useRef(onMapClick);
  const onPinMoveRef = useRef(onPinMove);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onPinMoveRef.current = onPinMove;
  });

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
    // Fix tile sizing inside flex/grid layouts.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const withCoords = direcciones
      .map((d, idx) => ({ d, idx }))
      .filter(({ d }) => d.lat != null && d.lng != null);

    for (const { d, idx } of withCoords) {
      const active = idx === activeIndex;
      const marker = L.marker([d.lat as number, d.lng as number], {
        icon: numberedIcon(idx + 1, active),
        draggable: active,
      }).addTo(map);
      if (active) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onPinMoveRef.current?.(idx, pos.lat, pos.lng);
        });
      }
      markersRef.current.push(marker);
    }

    const activeDir = direcciones[activeIndex];
    if (activeDir?.lat != null && activeDir?.lng != null) {
      map.setView([activeDir.lat, activeDir.lng], Math.max(map.getZoom(), 15));
    } else if (withCoords.length > 0) {
      const bounds = L.latLngBounds(
        withCoords.map(({ d }) => [d.lat as number, d.lng as number]),
      );
      map.fitBounds(bounds.pad(0.2));
    }
  }, [direcciones, activeIndex]);

  return <div ref={containerRef} className="h-full w-full min-h-[300px] rounded-lg" />;
}
