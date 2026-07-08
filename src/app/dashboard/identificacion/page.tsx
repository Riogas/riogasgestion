"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, SearchX, UserPlus, Search } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IdentificarForm } from "@/components/identificacion/IdentificarForm";
import { FichaRedactadaView } from "@/components/identificacion/FichaRedactadaView";
import type { IdentificarResultado } from "@/lib/types/persona";

export default function IdentificacionPage() {
  const [resultado, setResultado] = useState<IdentificarResultado | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identificación de cliente"
        description="Identificá al cliente por cédula o teléfono exacto antes de continuar la llamada."
      />

      <Card>
        <CardContent>
          <IdentificarForm onResult={setResultado} />
        </CardContent>
      </Card>

      {resultado?.resultado === "SIN_MATCH" && (
        <Card>
          <CardContent>
            <EmptyState
              icon={SearchX}
              title="No se encontró ningún cliente"
              description="Verificá el dato ingresado o dá de alta un cliente nuevo."
              action={
                <Button asChild className="gap-2">
                  <Link href="/dashboard/clientes/nuevo">
                    <UserPlus className="size-4" />
                    Dar de alta cliente nuevo
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {resultado?.resultado === "MATCH" && resultado.ficha && (
        <Card>
          <CardContent className="space-y-4">
            <FichaRedactadaView ficha={resultado.ficha} />

            {resultado.requiereAltaDireccion && (
              <Alert variant="warn">
                <AlertTriangle />
                <AlertTitle>Sin dirección en tu zona</AlertTitle>
                <AlertDescription>
                  <p>
                    Este cliente no tiene dirección en tu zona — dá de alta la dirección
                    correspondiente.
                  </p>
                  <Button asChild variant="outline" size="sm" className="gap-1.5 mt-1">
                    <Link href="/dashboard/clientes">
                      <Search className="size-4" />
                      Buscar cliente para agregar dirección
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
