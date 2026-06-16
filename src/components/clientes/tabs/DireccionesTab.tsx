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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDireccionMutations } from "@/hooks/clientes";
import { AddressPicker, type AddressPickerValue } from "@/components/clientes/AddressPicker";
import {
  type Cliente,
  type ClienteDireccion,
  type DireccionFormValues,
} from "@/lib/types/cliente";
import { Plus, Pencil, Trash2, Star, MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";

interface DireccionesTabProps {
  cliente: Cliente;
}

type EditingDir = Partial<DireccionFormValues> & { id?: string };

function dirToPickerValue(dir: EditingDir): AddressPickerValue {
  return {
    calle: dir.calle ?? "",
    nroPuerta: dir.nroPuerta ?? "",
    esquina1: dir.esquina1 ?? "",
    esquina2: dir.esquina2 ?? "",
    apto: dir.apto ?? "",
    local: dir.local ?? "",
    lat: dir.lat ?? undefined,
    lng: dir.lng ?? undefined,
    zona: dir.zona ?? undefined,
  };
}

export function DireccionesTab({ cliente }: DireccionesTabProps) {
  const { add, update, remove } = useDireccionMutations(cliente.id);
  const [editing, setEditing] = useState<EditingDir | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDir, setConfirmDir] = useState<ClienteDireccion | null>(null);

  const openNew = () => {
    setEditing({
      calle: "",
      nroPuerta: "",
      esquina1: "",
      esquina2: "",
      apto: "",
      local: "",
      zona: "",
      esPrincipal: cliente.direcciones.length === 0,
    });
    setFormOpen(true);
  };

  const openEdit = (dir: ClienteDireccion) => {
    setEditing({
      id: dir.id,
      calle: dir.calle,
      nroPuerta: dir.nroPuerta ?? "",
      esquina1: dir.esquina1 ?? "",
      esquina2: dir.esquina2 ?? "",
      apto: dir.apto ?? "",
      local: dir.local ?? "",
      departamentoId: dir.departamentoId ?? undefined,
      localidadId: dir.localidadId ?? undefined,
      zona: dir.zona ?? "",
      lat: dir.lat ?? undefined,
      lng: dir.lng ?? undefined,
      nivel: dir.nivel ?? "",
      esPrincipal: dir.esPrincipal,
      enZona: dir.enZona ?? undefined,
    });
    setFormOpen(true);
  };

  const cancel = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handlePickerChange = (patch: Partial<AddressPickerValue>) => {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...(patch.calle !== undefined && { calle: patch.calle }),
        ...(patch.nroPuerta !== undefined && { nroPuerta: patch.nroPuerta }),
        ...(patch.esquina1 !== undefined && { esquina1: patch.esquina1 }),
        ...(patch.esquina2 !== undefined && { esquina2: patch.esquina2 }),
        ...(patch.apto !== undefined && { apto: patch.apto }),
        ...(patch.local !== undefined && { local: patch.local }),
        ...(patch.lat !== undefined && { lat: patch.lat }),
        ...(patch.lng !== undefined && { lng: patch.lng }),
        ...(patch.zona !== undefined && { zona: patch.zona }),
      };
    });
  };

  const save = () => {
    if (!editing?.calle?.trim()) {
      toast.error("La calle es requerida");
      return;
    }

    const dto: DireccionFormValues = {
      calle: editing.calle!,
      nroPuerta: editing.nroPuerta || null,
      esquina1: editing.esquina1 || null,
      esquina2: editing.esquina2 || null,
      apto: editing.apto || null,
      local: editing.local || null,
      departamentoId: editing.departamentoId ?? null,
      localidadId: editing.localidadId ?? null,
      zona: editing.zona || null,
      lat: editing.lat ?? null,
      lng: editing.lng ?? null,
      nivel: editing.nivel || null,
      esPrincipal: editing.esPrincipal ?? false,
      enZona: editing.enZona ?? null,
    };

    if (editing.id) {
      update.mutate(
        { dirId: editing.id, dto },
        {
          onSuccess: () => { toast.success("Dirección actualizada"); cancel(); },
          onError: () => toast.error("Error al actualizar la dirección"),
        }
      );
    } else {
      add.mutate(dto, {
        onSuccess: () => { toast.success("Dirección agregada"); cancel(); },
        onError: () => toast.error("Error al agregar la dirección"),
      });
    }
  };

  const handleRemoveConfirmed = () => {
    if (!confirmDir) return;
    remove.mutate(confirmDir.id, {
      onSuccess: () => {
        toast.success("Dirección eliminada");
        setConfirmDir(null);
      },
      onError: () => {
        toast.error("Error al eliminar la dirección");
        setConfirmDir(null);
      },
    });
  };

  const isBusy = add.isPending || update.isPending || remove.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Direcciones ({cliente.direcciones.length})
        </h2>
        <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
          <Plus className="size-4" />
          Nueva dirección
        </Button>
      </div>

      {cliente.direcciones.length === 0 && !formOpen ? (
        <EmptyState
          icon={MapPin}
          title="Sin direcciones registradas"
          description="Agregá una dirección para poder ubicar a este cliente en el mapa."
          size="sm"
          action={
            <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
              <Plus className="size-4" />
              Agregar dirección
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Calle</TableHead>
              <TableHead className="w-20">N°</TableHead>
              <TableHead>Esquinas</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead className="w-20">En zona</TableHead>
              <TableHead className="w-8">Ppal.</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cliente.direcciones.map((dir) => (
              <TableRow key={dir.id}>
                <TableCell className="font-medium text-sm max-w-[200px] truncate" title={dir.calle}>
                  {dir.calle}
                  {dir.apto && (
                    <span className="text-muted-foreground ml-1 text-xs">Apto {dir.apto}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{dir.nroPuerta ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[dir.esquina1, dir.esquina2].filter(Boolean).join(" / ") || "—"}
                </TableCell>
                <TableCell className="text-sm">{dir.zona ?? "—"}</TableCell>
                <TableCell>
                  {dir.enZona === true ? (
                    <Badge variant="success">Sí</Badge>
                  ) : dir.enZona === false ? (
                    <Badge variant="destructive">No</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {dir.esPrincipal && (
                    <Star
                      role="img"
                      className="size-4 text-amber-500 fill-amber-500"
                      aria-label="Principal"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEdit(dir)}
                      aria-label={`Editar dirección ${dir.calle}`}
                      disabled={isBusy}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDir(dir)}
                      aria-label={`Eliminar dirección ${dir.calle}`}
                      disabled={isBusy}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Address picker form */}
      {formOpen && editing && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
          <h3 className="text-sm font-medium">
            {editing.id ? "Editar dirección" : "Nueva dirección"}
          </h3>

          <AddressPicker
            value={dirToPickerValue(editing)}
            onChange={handlePickerChange}
            onZonaChange={(result) => {
              setEditing((prev) => prev
                ? { ...prev, enZona: result.enZona, zona: result.zona ?? prev.zona }
                : prev
              );
            }}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dir-principal"
              checked={editing.esPrincipal ?? false}
              onChange={(e) =>
                setEditing((prev) => ({ ...prev!, esPrincipal: e.target.checked }))
              }
              className="rounded border-border"
            />
            <label htmlFor="dir-principal" className="text-sm cursor-pointer">
              Dirección principal
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancel} disabled={isBusy}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={isBusy}>
              {isBusy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDir} onOpenChange={(open) => { if (!open) setConfirmDir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar dirección</DialogTitle>
            <DialogDescription>
              ¿Eliminar la dirección{" "}
              <strong>
                {[confirmDir?.calle, confirmDir?.nroPuerta].filter(Boolean).join(" ")}
              </strong>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDir(null)}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveConfirmed}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
