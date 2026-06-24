"use client";

import dynamic from "next/dynamic";
import type { MapaDireccionesProps } from "./MapaDireccionesInner";

export type { MapaDireccionPin, MapaDireccionesProps } from "./MapaDireccionesInner";

const MapaDireccionesInner = dynamic(() => import("./MapaDireccionesInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full min-h-[300px] rounded-lg bg-muted/50 animate-pulse" />
  ),
});

export function MapaDirecciones(props: MapaDireccionesProps) {
  return <MapaDireccionesInner {...props} />;
}
