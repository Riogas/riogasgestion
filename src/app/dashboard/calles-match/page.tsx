import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import CallesMatch from "@/components/dashboard/calles-match/CallesMatch";

export default function CallesMatchPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Calles: nomenclator ↔ OSM"
        description="Revisión de la correlación entre el nomenclator del AS400 y el catálogo de calles de OSM. La cola viene ordenada por cantidad de clientes afectados."
      />
      <CallesMatch />
    </div>
  );
}
