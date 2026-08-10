"use client";

import dynamic from "next/dynamic";
import { MapPinOff } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { toNumero } from "./helpers";

export interface PuestoMapPreviewProps {
  lat?: string | number | null;
  lng?: string | number | null;
  nombre?: string | null;
  direccion?: string | null;
}

// Leaflet toca `window` al importarse: sin ssr:false rompe el build.
const Inner = dynamic(() => import("./PuestoMapPreviewInner"), {
  ssr: false,
  loading: () => <div className="h-[150px] w-full animate-pulse rounded-xl bg-muted/50" />,
});

/**
 * Mini mapa del panel de detalle. Si el puesto no tiene las dos coordenadas
 * no se monta el mapa: un Leaflet sin centro válido queda mirando al Golfo de
 * Guinea (0,0) y parece un bug.
 */
export default function PuestoMapPreview(props: PuestoMapPreviewProps) {
  const lat = toNumero(props.lat);
  const lng = toNumero(props.lng);

  if (lat === null || lng === null) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 py-6">
        <EmptyState
          icon={MapPinOff}
          title="Este puesto no tiene coordenadas cargadas."
          size="sm"
        />
      </div>
    );
  }

  return <Inner lat={lat} lng={lng} nombre={props.nombre} direccion={props.direccion} />;
}
