"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { AltaClienteWorkspace } from "@/components/clientes/AltaClienteWorkspace";

/**
 * Alta de cliente — workspace master-detail (datos + N direcciones / N teléfonos + mapa).
 */
export default function NuevoClientePage() {
  return (
    <div className="space-y-6 px-4 py-6">
      <PageHeader
        title="Nuevo cliente"
        description="Cargá los datos, las direcciones y los teléfonos. Geolocalizá tocando el mapa."
      />
      <AltaClienteWorkspace />
    </div>
  );
}
