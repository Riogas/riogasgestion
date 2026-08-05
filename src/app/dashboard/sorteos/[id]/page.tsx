"use client";

import { Suspense } from "react";
import SorteoDetalle from "@/components/dashboard/sorteos/SorteoDetalle";

export default function SorteoDetallePage() {
  // Suspense: SorteoDetalle usa nuqs (tab en URL); evita el CSR bailout en build.
  return (
    <Suspense fallback={null}>
      <SorteoDetalle />
    </Suspense>
  );
}
