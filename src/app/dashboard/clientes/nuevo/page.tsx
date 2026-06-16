"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { AltaWizard } from "@/components/clientes/AltaWizard";

/**
 * Alta detallada de cliente — wizard de 3 pasos.
 * La alta rápida (slide-over) se accede desde el botón "+ Nuevo" en la lista.
 */
export default function NuevoClientePage() {
  return (
    <div className="space-y-8 px-4 py-6 max-w-3xl mx-auto">
      <PageHeader
        title="Alta detallada de cliente"
        description="Flujo guiado en 3 pasos: datos, dirección y confirmación."
      />
      <AltaWizard />
    </div>
  );
}
