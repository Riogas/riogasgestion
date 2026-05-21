import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import ComparadorCalles from "@/components/normalizador-calles/ComparadorCalles";

export default function NormalizadorPage() {
  return (
    <div className="w-full h-full overflow-x-auto">
      <div className="min-w-[1200px] space-y-6">
        <PageHeader
          title="Normalizador de Calles"
          description="Comparación y normalización masiva de nombres de calles entre fuentes."
        />
        <ComparadorCalles />
      </div>
    </div>
  );
}
