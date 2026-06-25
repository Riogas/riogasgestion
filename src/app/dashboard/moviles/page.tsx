"use client";

import { Suspense } from "react";
import Moviles from "@/components/dashboard/moviles/Moviles";

export default function MovilesPage() {
  // Suspense: Moviles usa nuqs (useSearchParams); evita el CSR bailout en build.
  return (
    <Suspense fallback={null}>
      <Moviles />
    </Suspense>
  );
}
