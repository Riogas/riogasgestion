"use client";

import { Suspense } from "react";
import MovilDetalle from "@/components/dashboard/moviles/MovilDetalle";

export default function MovilDetallePage() {
  // Suspense: MovilDetalle usa nuqs (tab en URL); evita el CSR bailout en build.
  return (
    <Suspense fallback={null}>
      <MovilDetalle />
    </Suspense>
  );
}
