import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { estadoLabel, estadoVariant } from "@/lib/types/cliente";
import type { FichaRedactada } from "@/lib/types/persona";

interface FichaRedactadaViewProps {
  ficha: FichaRedactada;
}

/**
 * Renderiza una `FichaRedactada`. Todos los campos salvo `nombre` son opcionales
 * y dependen del `scope` devuelto por el backend — nunca asumimos su presencia.
 */
export function FichaRedactadaView({ ficha }: FichaRedactadaViewProps) {
  const { nombre, estado, cedula, telefono, direccion, scope } = ficha;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground leading-tight">{nombre}</p>
          {estado && <Badge variant={estadoVariant(estado)}>{estadoLabel(estado)}</Badge>}
        </div>
      </div>

      {scope === "MINIMA" && (
        <p className="text-sm text-muted-foreground">
          Datos limitados: el cliente no está afiliado a este distribuidor.
        </p>
      )}

      {scope !== "MINIMA" && (cedula || telefono || direccion) && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {cedula && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cédula</dt>
              <dd className="text-foreground">{cedula}</dd>
            </div>
          )}
          {telefono && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono</dt>
              <dd className="text-foreground">
                {telefono.numero}
                {telefono.alias ? ` (${telefono.alias})` : ""}
              </dd>
            </div>
          )}
          {direccion && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Dirección</dt>
              <dd className="text-foreground">
                {direccion.direccion ||
                  [direccion.calle, direccion.nro].filter(Boolean).join(" ") ||
                  "—"}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
