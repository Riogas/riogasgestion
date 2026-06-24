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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTelefonoMutations } from "@/hooks/clientes";
import {
  estadoLabel,
  estadoVariant,
  type Cliente,
  type ClienteTelefono,
  type TelefonoFormValues,
} from "@/lib/types/cliente";
import { Pencil, Trash2, Plus, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Phone } from "lucide-react";
import { toast } from "sonner";

interface TelefonosTabProps {
  cliente: Cliente;
}

const ESTADO_OPTIONS = [
  { value: "A", label: "Activo" },
  { value: "I", label: "Inactivo" },
];

type EditingTel = Partial<TelefonoFormValues> & { id?: number };

export function TelefonosTab({ cliente }: TelefonosTabProps) {
  const { add, update, remove } = useTelefonoMutations(cliente.id);
  const [editing, setEditing] = useState<EditingTel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmTel, setConfirmTel] = useState<ClienteTelefono | null>(null);

  const openNew = () => {
    setEditing({
      numero: "",
      alias: "",
      tipo: "",
      estado: "A",
      principal: cliente.telefonos.length === 0,
    });
    setFormOpen(true);
  };

  const openEdit = (tel: ClienteTelefono) => {
    setEditing({
      id: tel.id,
      numero: tel.numero,
      alias: tel.alias ?? "",
      tipo: tel.tipo ?? "",
      estado: tel.estado ?? "A",
      principal: tel.principal,
    });
    setFormOpen(true);
  };

  const cancel = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const save = () => {
    if (!editing?.numero?.trim()) {
      toast.error("El número es requerido");
      return;
    }

    const dto: TelefonoFormValues = {
      numero: editing.numero,
      alias: editing.alias || null,
      tipo: editing.tipo || null,
      estado: editing.estado ?? "A",
      principal: editing.principal ?? false,
    };

    if (editing.id) {
      update.mutate(
        { telId: editing.id, dto },
        {
          onSuccess: () => {
            toast.success("Teléfono actualizado");
            cancel();
          },
          onError: () => toast.error("Error al actualizar el teléfono"),
        },
      );
    } else {
      add.mutate(dto, {
        onSuccess: () => {
          toast.success("Teléfono agregado");
          cancel();
        },
        onError: () => toast.error("Error al agregar el teléfono"),
      });
    }
  };

  const handleRemoveConfirmed = () => {
    if (!confirmTel) return;
    remove.mutate(confirmTel.id, {
      onSuccess: () => {
        toast.success("Teléfono eliminado");
        setConfirmTel(null);
      },
      onError: () => {
        toast.error("No se pudo eliminar el teléfono");
        setConfirmTel(null);
      },
    });
  };

  const isBusy = add.isPending || update.isPending || remove.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Teléfonos ({cliente.telefonos.length})
        </h2>
        <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
          <Plus className="size-4" />
          Nuevo teléfono
        </Button>
      </div>

      {cliente.telefonos.length === 0 && !formOpen ? (
        <EmptyState
          icon={Phone}
          title="Sin teléfonos registrados"
          description="Agregá un teléfono para poder contactar a este cliente."
          size="sm"
          action={
            <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
              <Plus className="size-4" />
              Agregar teléfono
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Alias</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-8">Ppal.</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cliente.telefonos.map((tel) => (
              <TableRow key={tel.id}>
                <TableCell className="font-mono text-sm">{tel.numero}</TableCell>
                <TableCell className="text-sm">{tel.alias ?? "—"}</TableCell>
                <TableCell>
                  {tel.tipo ? <Badge variant="outline">{tel.tipo}</Badge> : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={estadoVariant(tel.estado)}>
                    {estadoLabel(tel.estado)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {tel.principal && (
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
                      onClick={() => openEdit(tel)}
                      aria-label={`Editar teléfono ${tel.numero}`}
                      disabled={isBusy}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setConfirmTel(tel)}
                      aria-label={`Eliminar teléfono ${tel.numero}`}
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

      {formOpen && editing && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
          <h3 className="text-sm font-medium">
            {editing.id ? "Editar teléfono" : "Nuevo teléfono"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tel-numero">
                Número <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="tel-numero"
                value={editing.numero ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...prev!, numero: e.target.value }))}
                placeholder="Ej: 098 123 456"
                aria-required="true"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tel-alias">Alias</Label>
              <Input
                id="tel-alias"
                value={editing.alias ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...prev!, alias: e.target.value }))}
                placeholder="Ej: Casa, trabajo"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tel-tipo">Tipo</Label>
              <Input
                id="tel-tipo"
                value={editing.tipo ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...prev!, tipo: e.target.value }))}
                placeholder="Ej: PE, VE"
                maxLength={2}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tel-estado">Estado</Label>
              <Select
                value={editing.estado ?? "A"}
                onValueChange={(v) => setEditing((prev) => ({ ...prev!, estado: v }))}
              >
                <SelectTrigger id="tel-estado">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tel-principal"
              checked={editing.principal ?? false}
              onChange={(e) => setEditing((prev) => ({ ...prev!, principal: e.target.checked }))}
              className="rounded border-border"
            />
            <Label htmlFor="tel-principal" className="text-sm cursor-pointer">
              Teléfono principal
            </Label>
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

      <Dialog
        open={!!confirmTel}
        onOpenChange={(open) => {
          if (!open) setConfirmTel(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar teléfono</DialogTitle>
            <DialogDescription>
              ¿Eliminar el teléfono <strong>{confirmTel?.numero}</strong>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTel(null)} disabled={remove.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemoveConfirmed} disabled={remove.isPending}>
              {remove.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
