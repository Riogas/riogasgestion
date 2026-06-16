"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import ClientesList from "@/components/dashboard/clientes/ClientesList";

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cartera de clientes — alta, edición y zonas asignadas."
      />
      <ClientesList />
    </div>
  );
}
