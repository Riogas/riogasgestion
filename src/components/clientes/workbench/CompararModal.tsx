"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCliente } from "@/hooks/clientes";
import { usePersona } from "@/hooks/personas";
import { useSugerenciaMutations } from "@/hooks/workbench";
import type { MatchSugerencia, Persona360 } from "@/lib/types/persona";
import type { Cliente } from "@/lib/types/cliente";
import { cn } from "@/lib/utils";
import { GitMerge, Home, Loader2, Undo2, X } from "lucide-react";

interface CompararModalProps {
  sugerencia: MatchSugerencia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalize(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export function CompararModal({
  sugerencia,
  open,
  onOpenChange,
}: CompararModalProps) {
  const tipo = sugerencia?.tipo;

  // Los hooks se llaman siempre (reglas de hooks); quedan deshabilitados
  // (`enabled: !!id`) cuando el id no corresponde al tipo de sugerencia.
  const registroAId =
    tipo === "DUPLICADO" && sugerencia?.registroA != null
      ? String(sugerencia.registroA)
      : null;
  const registroBId =
    tipo === "DUPLICADO" && sugerencia?.registroB != null
      ? String(sugerencia.registroB)
      : null;
  const personaAId = tipo === "HOGAR" ? sugerencia?.personaA ?? null : null;
  const personaBId = tipo === "HOGAR" ? sugerencia?.personaB ?? null : null;

  const clienteA = useCliente(registroAId);
  const clienteB = useCliente(registroBId);
  const personaA = usePersona(personaAId);
  const personaB = usePersona(personaBId);

  const { aceptar, rechazar, deshacer } = useSugerenciaMutations();

  if (!sugerencia) return null;

  const isPending = aceptar.isPending || rechazar.isPending || deshacer.isPending;

  const handleAceptar = () => {
    aceptar.mutate(sugerencia.id, { onSuccess: () => onOpenChange(false) });
  };
  const handleRechazar = () => {
    rechazar.mutate(sugerencia.id, { onSuccess: () => onOpenChange(false) });
  };
  const handleDeshacer = () => {
    deshacer.mutate(sugerencia.id, { onSuccess: () => onOpenChange(false) });
  };

  const loadingRecords =
    tipo === "DUPLICADO"
      ? clienteA.isLoading || clienteB.isLoading
      : personaA.isLoading || personaB.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipo === "DUPLICADO" ? (
              <GitMerge className="size-4" />
            ) : (
              <Home className="size-4" />
            )}
            {tipo === "DUPLICADO"
              ? "Comparar registros duplicados"
              : "Comparar hogar sugerido"}
          </DialogTitle>
          <DialogDescription>
            Señal: <span className="font-medium text-foreground">{sugerencia.senal}</span>{" "}
            · Confianza:{" "}
            <span className="font-medium text-foreground">
              {Math.round(sugerencia.confianza * 100)}%
            </span>
          </DialogDescription>
        </DialogHeader>

        {loadingRecords ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Cargando registros…
          </div>
        ) : tipo === "DUPLICADO" ? (
          <ClienteCompareGrid a={clienteA.data} b={clienteB.data} />
        ) : (
          <PersonaCompareGrid a={personaA.data} b={personaB.data} />
        )}

        <DialogFooter>
          {sugerencia.estado === "PENDIENTE" ? (
            <>
              <Button
                variant="outline"
                onClick={handleRechazar}
                disabled={isPending}
                className="gap-1.5"
              >
                <X className="size-4" />
                Rechazar
              </Button>
              <Button onClick={handleAceptar} disabled={isPending} className="gap-1.5">
                {tipo === "DUPLICADO" ? (
                  <>
                    <GitMerge className="size-4" />
                    Unificar
                  </>
                ) : (
                  <>
                    <Home className="size-4" />
                    Confirmar hogar
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={handleDeshacer}
              disabled={isPending}
              className="gap-1.5"
            >
              <Undo2 className="size-4" />
              Deshacer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Comparison grids ─────────────────────────────────────────────────────────

interface CompareRow {
  label: string;
  a: string;
  b: string;
}

function CompareTable({
  headerA,
  headerB,
  rows,
}: {
  headerA: string;
  headerB: string;
  rows: CompareRow[];
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border/60 overflow-hidden">
      <div className="grid grid-cols-[140px_1fr_1fr] bg-muted/40 border-b border-border/60">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Campo
        </div>
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {headerA}
        </div>
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {headerB}
        </div>
      </div>
      {rows.map((r) => {
        const match = normalize(r.a) !== "" && normalize(r.a) === normalize(r.b);
        return (
          <div
            key={r.label}
            className="grid grid-cols-[140px_1fr_1fr] border-b border-border/40 last:border-0"
          >
            <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground flex items-center">
              {r.label}
            </div>
            <FieldCell value={r.a} match={match} />
            <FieldCell value={r.b} match={match} />
          </div>
        );
      })}
    </div>
  );
}

function FieldCell({ value, match }: { value: string; match: boolean }) {
  return (
    <div
      className={cn(
        "px-3 py-2.5 text-sm",
        match && "bg-success/10 text-success font-medium",
      )}
    >
      {value || "—"}
    </div>
  );
}

function ClienteCompareGrid({ a, b }: { a?: Cliente; b?: Cliente }) {
  if (!a || !b) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar los registros a comparar.
      </p>
    );
  }

  const telA = a.telefonos.find((t) => t.principal)?.numero ?? a.telefonos[0]?.numero ?? null;
  const telB = b.telefonos.find((t) => t.principal)?.numero ?? b.telefonos[0]?.numero ?? null;
  const dirA =
    a.direcciones.find((d) => d.principal)?.direccion ?? a.direcciones[0]?.direccion ?? null;
  const dirB =
    b.direcciones.find((d) => d.principal)?.direccion ?? b.direcciones[0]?.direccion ?? null;

  const rows: CompareRow[] = [
    { label: "Nombre", a: a.nombre ?? "", b: b.nombre ?? "" },
    { label: "RUC", a: a.ruc ?? "", b: b.ruc ?? "" },
    { label: "Cédula", a: a.cedula ?? "", b: b.cedula ?? "" },
    { label: "Teléfono principal", a: telA ?? "", b: telB ?? "" },
    { label: "Dirección principal", a: dirA ?? "", b: dirB ?? "" },
  ];

  return <CompareTable headerA={`Registro #${a.id}`} headerB={`Registro #${b.id}`} rows={rows} />;
}

function PersonaCompareGrid({ a, b }: { a?: Persona360; b?: Persona360 }) {
  if (!a || !b) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No se pudieron cargar las personas a comparar.
      </p>
    );
  }

  const nombreA = a.persona.nombreOficial ?? a.registros[0]?.nombre ?? null;
  const nombreB = b.persona.nombreOficial ?? b.registros[0]?.nombre ?? null;
  const dirA =
    a.direcciones.find((d) => d.principal)?.direccion ?? a.direcciones[0]?.direccion ?? null;
  const dirB =
    b.direcciones.find((d) => d.principal)?.direccion ?? b.direcciones[0]?.direccion ?? null;

  const rows: CompareRow[] = [
    { label: "Nombre", a: nombreA ?? "", b: nombreB ?? "" },
    { label: "Cédula", a: a.persona.cedula ?? "", b: b.persona.cedula ?? "" },
    { label: "Dirección principal", a: dirA ?? "", b: dirB ?? "" },
  ];

  return (
    <CompareTable
      headerA={`Persona #${a.persona.id}`}
      headerB={`Persona #${b.persona.id}`}
      rows={rows}
    />
  );
}
