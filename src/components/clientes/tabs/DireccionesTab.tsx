"use client";

import { useState } from "react";
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
import { DireccionEditor, type DireccionEditorValue } from "@/components/clientes/DireccionEditor";
import { MapaDirecciones } from "@/components/clientes/MapaDirecciones";
import { reverseGeocode, geocode } from "@/services/geocode";
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

type EditingDir = DireccionEditorValue & { id?: number };

export function DireccionesTab({ cliente }: DireccionesTabProps) {
  const { add, update, remove } = useDireccionMutations(cliente.id);
  const [editing, setEditing] = useState<EditingDir | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [confirmDir, setConfirmDir] = useState<ClienteDireccion | null>(null);

  const openNew = () => {
    setEditing({
      calle: "",
      nro: "",
      esquina1: "",
      esquina2: "",
      apto: "",
      local: "",
      principal: cliente.direcciones.length === 0,
      estado: "A",
    });
    setFormOpen(true);
  };

  const openEdit = (dir: ClienteDireccion) => {
    setEditing({
      id: dir.id,
      calle: dir.calle ?? "",
      nro: dir.nro ?? "",
      esquina1: dir.esquina1 ?? "",
      esquina2: dir.esquina2 ?? "",
      apto: dir.apto ?? "",
      local: dir.local ?? "",
      departamentoId: dir.departamentoId ?? null,
      localidadId: dir.localidadId ?? null,
      lat: dir.lat ?? null,
      lng: dir.lng ?? null,
      principal: dir.principal,
      estado: dir.estado ?? "A",
    });
    setFormOpen(true);
  };

  const cancel = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleEditorChange = (patch: Partial<EditingDir>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleGeolocate = async () => {
    if (!editing) return;
    const parts = [editing.calle, editing.nro].filter(Boolean).join(" ");
    if (!parts.trim()) {
      toast.error("Escribí una calle para geolocalizar");
      return;
    }
    setGeolocating(true);
    try {
      const res = await geocode(`${parts}, Uruguay`);
      if (!res) {
        toast.error("No se encontró la dirección");
        return;
      }
      handleEditorChange({ lat: res.lat, lng: res.lng, _geoCalle: res.calle ?? null });
    } finally {
      setGeolocating(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!editing) return;
    handleEditorChange({ lat, lng });
    const res = await reverseGeocode(lat, lng);
    if (res) {
      handleEditorChange({
        lat,
        lng,
        calle: editing.calle || res.calle || editing.calle,
        _geoCalle: res.calle ?? null,
      });
    }
  };

  const save = () => {
    if (!editing) return;
    const dto: DireccionFormValues = {
      calle: editing.calle || null,
      nro: editing.nro || null,
      esquina1: editing.esquina1 || null,
      esquina2: editing.esquina2 || null,
      apto: editing.apto || null,
      local: editing.local || null,
      departamentoId: editing.departamentoId ?? null,
      localidadId: editing.localidadId ?? null,
      lat: editing.lat ?? null,
      lng: editing.lng ?? null,
      direccion: editing.direccion ?? null,
      principal: editing.principal ?? false,
      estado: editing.estado ?? "A",
    };

    if (editing.id) {
      update.mutate(
        { dirId: editing.id, dto },
        {
          onSuccess: () => {
            toast.success("Dirección actualizada");
            cancel();
          },
          onError: () => toast.error("Error al actualizar la dirección"),
        },
      );
    } else {
      add.mutate(dto, {
        onSuccess: () => {
          toast.success("Dirección agregada");
          cancel();
        },
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
        toast.error("No se pudo eliminar la dirección");
        setConfirmDir(null);
      },
    });
  };

  const isBusy = add.isPending || update.isPending || remove.isPending;

  const mapPins = editing
    ? [{ lat: editing.lat ?? null, lng: editing.lng ?? null }]
    : cliente.direcciones.map((d) => ({ lat: d.lat, lng: d.lng }));

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
        <div className="space-y-2">
          {cliente.direcciones.map((dir) => (
            <div
              key={dir.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {[dir.calle, dir.nro].filter(Boolean).join(" ") || "Sin calle"}
                  </span>
                  {dir.principal && (
                    <Star
                      role="img"
                      className="size-3.5 text-amber-500 fill-amber-500 shrink-0"
                      aria-label="Principal"
                    />
                  )}
                  {dir.lat == null && (
                    <Badge variant="secondary" className="text-[10px]">
                      s/coord
                    </Badge>
                  )}
                </div>
                {dir.direccion && (
                  <p className="text-xs text-muted-foreground truncate">{dir.direccion}</p>
                )}
              </div>
              <div className="inline-flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => openEdit(dir)}
                  aria-label={`Editar dirección ${dir.calle ?? ""}`}
                  disabled={isBusy}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setConfirmDir(dir)}
                  aria-label={`Eliminar dirección ${dir.calle ?? ""}`}
                  disabled={isBusy}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && editing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">
              {editing.id ? "Editar dirección" : "Nueva dirección"}
            </h3>

            <DireccionEditor
              value={editing}
              onChange={handleEditorChange}
              onGeolocate={handleGeolocate}
              geolocating={geolocating}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dir-principal"
                checked={editing.principal ?? false}
                onChange={(e) => handleEditorChange({ principal: e.target.checked })}
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

          <div className="min-h-[300px] rounded-lg overflow-hidden border border-border">
            <MapaDirecciones
              direcciones={mapPins}
              activeIndex={0}
              onMapClick={handleMapClick}
              onPinMove={(_idx, lat, lng) => handleMapClick(lat, lng)}
            />
          </div>
        </div>
      )}

      <Dialog
        open={!!confirmDir}
        onOpenChange={(open) => {
          if (!open) setConfirmDir(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar dirección</DialogTitle>
            <DialogDescription>
              ¿Eliminar la dirección{" "}
              <strong>{[confirmDir?.calle, confirmDir?.nro].filter(Boolean).join(" ")}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDir(null)} disabled={remove.isPending}>
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
