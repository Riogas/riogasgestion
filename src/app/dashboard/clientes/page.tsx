"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Merge, UserSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import ClientesList from "@/components/dashboard/clientes/ClientesList";

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Cartera de clientes — alta, edición y zonas asignadas."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/identificacion">
                <UserSearch className="h-4 w-4 mr-1.5" />
                Identificación
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/clientes/workbench">
                <Merge className="h-4 w-4 mr-1.5" />
                Workbench de deduplicación
              </Link>
            </Button>
          </>
        }
      />
      {/* Suspense: ClientesList usa nuqs (useSearchParams); evita el CSR bailout en build. */}
      <Suspense fallback={null}>
        <ClientesList />
      </Suspense>
    </div>
  );
}
