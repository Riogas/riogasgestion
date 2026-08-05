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
import { useCrearSorteo } from "@/hooks/sorteos";
import type { Sorteo } from "@/lib/types/sorteo";
import { SorteoFormFields } from "./SorteoFormFields";
import {
  SORTEO_FORM_DEFAULTS,
  payloadDesdeValores,
  sorteoFormSchema,
  type SorteoFormValues,
} from "./helpers";

// Solo alta. La edición vive en la pestaña Configuración del detalle
// (`SorteoConfigTab`), que además bloquea los sorteos cerrados y avisa que
// cambiar fechas o premios regenera los momentos ganadores pendientes.
interface SorteoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (sorteo: Sorteo) => void;
}

export function SorteoFormDialog({
  open,
  onOpenChange,
  onCreated,
}: SorteoFormDialogProps) {
  const crear = useCrearSorteo();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SorteoFormValues>({
    resolver: zodResolver(sorteoFormSchema),
    defaultValues: SORTEO_FORM_DEFAULTS,
  });

  // Al reabrir el dialog el form vuelve a los defaults.
  useEffect(() => {
    if (open) reset(SORTEO_FORM_DEFAULTS);
  }, [open, reset]);

  const pending = crear.isPending;

  const onSubmit = (values: SorteoFormValues) => {
    crear.mutate(payloadDesdeValores(values), {
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
            Nuevo sorteo
          </DialogTitle>
          <DialogDescription>
            El sorteo se crea en estado borrador: podés generar los códigos antes de
            activarlo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <SorteoFormFields
            register={register}
            errors={errors}
            idPrefix="sorteo-nuevo"
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
              {pending ? "Guardando…" : "Crear sorteo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
