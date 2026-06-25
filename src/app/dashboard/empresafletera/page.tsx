"use client";

import { Suspense } from "react";
import EmpresasFleteras from "@/components/dashboard/empresafletera/EmpresasFleteras";

export default function EmpresaFleteraPage() {
  // Suspense: EmpresasFleteras usa nuqs (useSearchParams); evita el CSR
  // bailout en build.
  return (
    <Suspense fallback={null}>
      <EmpresasFleteras />
    </Suspense>
  );
}
