"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActualizarSorteo, useCrearSorteo } from "@/hooks/sorteos";
import type { Sorteo } from "@/lib/types/sorteo";
import { SorteoFormFields } from "./SorteoFormFields";
import {
  SORTEO_FORM_DEFAULTS,
  payloadDesdeValores,
  sorteoFormSchema,
  valoresDesdeSorteo,
  type SorteoFormValues,
} from "./helpers";

interface SorteoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si viene, el dialog edita ese sorteo; si no, crea uno nuevo. */
  sorteo?: Sorteo | null;
  onCreated?: (sorteo: Sorteo) => void;
}

export function SorteoFormDialog({
  open,
  onOpenChange,
  sorteo = null,
  onCreated,
}: SorteoFormDialogProps) {
  const crear = useCrearSorteo();
  const actualizar = useActualizarSorteo();
  const editando = !!sorteo;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SorteoFormValues>({
    resolver: zodResolver(sorteoFormSchema),
    defaultValues: sorteo ? valoresDesdeSorteo(sorteo) : SORTEO_FORM_DEFAULTS,
  });

  // Al reabrir el dialog el form vuelve al estado del sorteo (o a los defaults).
  useEffect(() => {
    if (open) reset(sorteo ? valoresDesdeSorteo(sorteo) : SORTEO_FORM_DEFAULTS);
  }, [open, sorteo, reset]);

  const pending = crear.isPending || actualizar.isPending;

  const onSubmit = (values: SorteoFormValues) => {
    const payload = payloadDesdeValores(values);

    if (sorteo) {
      actualizar.mutate(
        { id: sorteo.id, payload },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }

    crear.mutate(payload, {
      onSuccess: (creado) => {
        onOpenChange(false);
        onCreated?.(creado);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl lg:max-w-2xl xl:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-5 text-primary" />
            {editando ? "Editar sorteo" : "Nuevo sorteo"}
          </DialogTitle>
          <DialogDescription>
            {editando
              ? "Los cambios de fechas o cantidad de premios regeneran los momentos ganadores pendientes."
              : "El sorteo se crea en estado borrador: podés generar los códigos antes de activarlo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <SorteoFormFields
            register={register}
            errors={errors}
            idPrefix={editando ? `sorteo-editar-${sorteo?.id}` : "sorteo-nuevo"}
            disabled={pending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <Save className="size-4" />
              {pending ? "Guardando…" : editando ? "Guardar cambios" : "Crear sorteo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
