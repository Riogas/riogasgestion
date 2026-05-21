"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import Moviles from "@/components/dashboard/moviles/Moviles";

export default function MovilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Móviles"
        description="Flota, ubicaciones y estado de cada unidad."
      />
      <Moviles />
    </div>
  );
}
