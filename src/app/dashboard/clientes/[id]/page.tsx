"use client";

import { useParams } from "next/navigation";
import { useCliente } from "@/hooks/clientes";
import { ClienteHeader } from "@/components/clientes/ClienteHeader";
import { ClienteResumen } from "@/components/clientes/ClienteResumen";
import { ClienteTabs } from "@/components/clientes/ClienteTabs";
import { NuqsAdapter } from "nuqs/adapters/next/app";

// ── Skeletons ────────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="sticky top-16 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumenSkeleton() {
  return (
    <aside className="w-64 min-w-[16rem] border-r border-border bg-card p-4 space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-6 bg-muted animate-pulse rounded" />
      ))}
    </aside>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ClientePageInner() {
  const params = useParams();
  const clienteId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: cliente, isLoading, isError, error } = useCliente(clienteId ?? null);

  if (!clienteId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error: ID de cliente no proporcionado</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <HeaderSkeleton />
        <div className="flex flex-1 min-h-0">
          <ResumenSkeleton />
          <div className="flex-1 p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !cliente) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">No se pudo cargar el cliente</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ClienteHeader cliente={cliente} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ClienteResumen cliente={cliente} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <ClienteTabs cliente={cliente} />
        </main>
      </div>
    </div>
  );
}

export default function EditarClientePage() {
  return (
    <NuqsAdapter>
      <ClientePageInner />
    </NuqsAdapter>
  );
}
