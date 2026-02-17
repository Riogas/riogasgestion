"use client";

import { Card } from "@/components/ui/card";
import Asignaciones from "@/components/configuracion/Asignaciones";

export default function AsignacionesPage() {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Asignación de Móviles</h1>
      </div>
      <Asignaciones />
    </Card>
  );
}
