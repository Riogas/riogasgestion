"use client";

import { useParams } from "next/navigation";
import { usePersona } from "@/hooks/personas";
import { Persona360 } from "@/components/clientes/persona/Persona360";

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Persona360Skeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-6 w-56 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          </div>
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function PersonaPageInner() {
  const params = useParams();
  const personaId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data, isLoading, isError, error } = usePersona(personaId ?? null);

  if (!personaId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error: ID de persona no proporcionado</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <Persona360Skeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">No se pudo cargar la persona</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <Persona360 data={data} />
    </div>
  );
}

export default function PersonaPage() {
  return <PersonaPageInner />;
}
