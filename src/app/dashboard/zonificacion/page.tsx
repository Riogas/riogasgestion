"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Leaflet necesita window: la pantalla se carga solo en el cliente.
const Zonificacion = dynamic(
  () => import("@/components/dashboard/zonificacion/Zonificacion"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-5">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-muted" />
        <div className="h-[560px] w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    ),
  },
);

export default function ZonificacionPage() {
  // Suspense: Zonificacion usa nuqs (useSearchParams); evita el CSR bailout en build.
  return (
    <Suspense fallback={null}>
      <Zonificacion />
    </Suspense>
  );
}
