"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import SorteosList from "@/components/dashboard/sorteos/SorteosList";

export default function SorteosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sorteos"
        description="Campañas con QR: códigos, participaciones y entrega de premios."
      />
      {/* Suspense: SorteosList usa nuqs (useSearchParams); evita el CSR bailout en build. */}
      <Suspense fallback={null}>
        <SorteosList />
      </Suspense>
    </div>
  );
}
