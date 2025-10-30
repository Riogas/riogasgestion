"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";

// Importar Zonificacion dinámicamente para evitar SSR
const Zonificacion = dynamic(() => import("@/components/configuracion/Zonificacion"), {
  ssr: false,
  loading: () => <div className="p-6">Cargando zonificación...</div>,
});

export default function ZonificacionPage() {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administración de Zonificación</h1>
      </div>
      <Zonificacion />
    </Card>
  );
}
