"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

/**
 * Placeholder para el alta de cliente.
 * El formulario de alta real se construye en la Fase 4 mediante AltaSlideOver + AltaWizard.
 */
export default function NuevoClientePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-muted">
        <Construction className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Alta de cliente</h1>
        <p className="text-muted-foreground max-w-sm">
          El formulario de alta se está reconstruyendo. Estará disponible en la
          Fase 4 con el nuevo flujo de slide-over guiado.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => router.push("/dashboard/clientes")}
        className="gap-2"
      >
        <ArrowLeft className="size-4" />
        Volver a la lista
      </Button>
    </div>
  );
}
