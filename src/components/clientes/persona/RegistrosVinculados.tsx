"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePersonaMutations } from "@/hooks/personas";
import { estadoLabel, estadoVariant, type Cliente } from "@/lib/types/cliente";
import { Split, Users } from "lucide-react";

interface RegistrosVinculadosProps {
  personaId: number;
  registros: Cliente[];
}

export function RegistrosVinculados({
  personaId,
  registros,
}: RegistrosVinculadosProps) {
  const { split } = usePersonaMutations(personaId);
  const [confirmRegistro, setConfirmRegistro] = useState<Cliente | null>(null);

  const handleSplit = () => {
    if (!confirmRegistro) return;
    split.mutate([confirmRegistro.id], {
      onSuccess: () => setConfirmRegistro(null),
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Registros vinculados ({registros.length})
      </h2>

      {registros.length === 0 ? (
        <EmptyState
          icon={Users}
          size="sm"
          title="Sin registros vinculados"
          description="Esta persona no tiene registros de cliente asociados."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origen</TableHead>
              <TableHead>ID original</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((registro) => (
              <TableRow key={registro.id}>
                <TableCell>
                  <Badge variant="info">{registro.origen}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {registro.idOriginal}
                </TableCell>
                <TableCell className="truncate max-w-[280px]" title={registro.nombre ?? ""}>
                  {registro.nombre ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={estadoVariant(registro.estado)}>
                    {estadoLabel(registro.estado)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setConfirmRegistro(registro)}
                    disabled={split.isPending}
                  >
                    <Split className="size-3.5" />
                    Separar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={!!confirmRegistro}
        onOpenChange={(open) => {
          if (!open) setConfirmRegistro(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Separar registro</DialogTitle>
            <DialogDescription>
              El registro <strong>{confirmRegistro?.nombre ?? "—"}</strong> (origen{" "}
              {confirmRegistro?.origen}, ID {confirmRegistro?.idOriginal}) se separará de esta
              persona y pasará a formar una identidad propia. Esta acción se puede revertir
              unificándolo nuevamente desde el workbench.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRegistro(null)}
              disabled={split.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSplit}
              disabled={split.isPending}
            >
              {split.isPending ? "Separando…" : "Confirmar separación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
