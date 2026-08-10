"use client";

import { Suspense } from "react";
import PuestosView from "@/components/dashboard/puestos/PuestosView";

export default function PuestosPage() {
  // Suspense: PuestosView usa nuqs (useSearchParams) y sin esto el build
  // hace CSR bailout de toda la ruta.
  return (
    <Suspense fallback={null}>
      <PuestosView />
    </Suspense>
  );
}
