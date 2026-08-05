"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Ban, CheckCircle2, Info, Lock, Rocket, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActualizarSorteo, useCambiarEstadoSorteo } from "@/hooks/sorteos";
import { estadoSorteoBadge, type SorteoDetalle } from "@/lib/types/sorteo";
import { ConfirmDialog } from "./ConfirmDialog";
import { SorteoFormFields } from "./SorteoFormFields";
import {
  fmtNumero,
  payloadDesdeValores,
  sorteoFormSchema,
  valoresDesdeSorteo,
  type SorteoFormValues,
} from "./helpers";

type Accion = "activar" | "finalizar" | "cancelar";

export function SorteoConfigTab({ sorteo }: { sorteo: SorteoDetalle }) {
  const actualizar = useActualizarSorteo();
  const cambiarEstado = useCambiarEstadoSorteo();
  const [accion, setAccion] = useState<Accion | null>(null);

  const soloLectura = sorteo.estado === "finalizado" || sorteo.estado === "cancelado";
  const badge = estadoSorteoBadge(sorteo.estado);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SorteoFormValues>({
    resolver: zodResolver(sorteoFormSchema),
    defaultValues: valoresDesdeSorteo(sorteo),
  });

  // El detalle se refetchea tras cada mutation: el form vuelve al valor guardado.
  useEffect(() => {
    reset(valoresDesdeSorteo(sorteo));
  }, [sorteo, reset]);

  const onSubmit = (values: SorteoFormValues) => {
    actualizar.mutate(
      { id: sorteo.id, payload: payloadDesdeValores(values) },
      { onSuccess: () => reset(values) },
    );
  };

  const confirmarAccion = () => {
    if (!accion) return;
    cambiarEstado.mutate({ id: sorteo.id, accion }, { onSuccess: () => setAccion(null) });
  };

  const textosAccion: Record<
    Accion,
    { title: string; description: string; confirmLabel: string; cancelLabel?: string }
  > = {
    activar: {
      title: "¿Activar el sorteo?",
      description: `Se generan ${fmtNumero(sorteo.cantidadPremios)} momentos ganadores repartidos al azar dentro del rango de fechas. A partir de ahí el sorteo acepta participaciones y no puede volver a borrador.`,
      confirmLabel: "Activar sorteo",
    },
    finalizar: {
      title: "¿Finalizar el sorteo?",
      description:
        "El sorteo deja de aceptar participaciones de inmediato. Los premios pendientes se siguen entregando desde la pestaña Ganadores.",
      confirmLabel: "Finalizar sorteo",
    },
    cancelar: {
      title: "¿Cancelar el sorteo?",
      description:
        "El sorteo deja de aceptar participaciones y no se puede reactivar. Los códigos ya impresos quedan sin uso.",
      confirmLabel: "Sí, cancelar el sorteo",
      // Un botón "Cancelar" al lado de "Cancelar sorteo" es ambiguo y la acción
      // es irreversible.
      cancelLabel: "No, dejarlo como está",
    },
  };

  return (
    <div className="space-y-5">
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-base">Parámetros del sorteo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nombre, premio, vigencia y límites de participación.
          </p>
        </CardHeader>
        <CardContent>
          {soloLectura ? (
            <Alert variant="default" className="mb-4">
              <Lock />
              <AlertTitle>Parámetros en solo lectura</AlertTitle>
              <AlertDescription>
                El sorteo está {badge.label.toLowerCase()}: ya no se pueden modificar sus datos.
              </AlertDescription>
            </Alert>
          ) : (
            sorteo.estado === "activo" && (
              <Alert variant="warn" className="mb-4">
                <AlertTriangle />
                <AlertTitle>El sorteo está activo</AlertTitle>
                <AlertDescription>
                  Cambiar las fechas o la cantidad de premios regenera los momentos ganadores
                  que todavía no fueron otorgados. Los premios ya entregados no se tocan.
                </AlertDescription>
              </Alert>
            )
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <SorteoFormFields
              register={register}
              errors={errors}
              idPrefix={`sorteo-config-${sorteo.id}`}
              disabled={soloLectura || actualizar.isPending}
            />
            <div className="flex items-center justify-end gap-2">
              {isDirty && !soloLectura && (
                <span className="text-xs text-muted-foreground">Hay cambios sin guardar</span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => reset(valoresDesdeSorteo(sorteo))}
                disabled={!isDirty || soloLectura || actualizar.isPending}
              >
                Descartar
              </Button>
              <Button type="submit" disabled={!isDirty || soloLectura || actualizar.isPending}>
                <Save className="size-4" />
                {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-3">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Estado del sorteo</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Las transiciones de estado son definitivas: revisá los datos antes de confirmar.
              </p>
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sorteo.estado === "borrador" && (
            <Alert variant="info">
              <Info />
              <AlertTitle>Todavía no acepta participaciones</AlertTitle>
              <AlertDescription>
                Generá los códigos que vas a imprimir y activá el sorteo cuando esté todo listo.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {sorteo.estado === "borrador" && (
              <Button onClick={() => setAccion("activar")} disabled={cambiarEstado.isPending}>
                <Rocket className="size-4" />
                Activar sorteo
              </Button>
            )}
            {sorteo.estado === "activo" && (
              <Button
                variant="secondary"
                onClick={() => setAccion("finalizar")}
                disabled={cambiarEstado.isPending}
              >
                <CheckCircle2 className="size-4" />
                Finalizar sorteo
              </Button>
            )}
            {(sorteo.estado === "borrador" || sorteo.estado === "activo") && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setAccion("cancelar")}
                disabled={cambiarEstado.isPending}
              >
                <Ban className="size-4" />
                Cancelar sorteo
              </Button>
            )}
            {soloLectura && (
              <p className="text-sm text-muted-foreground">
                No hay acciones disponibles para un sorteo {badge.label.toLowerCase()}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={accion !== null}
        onOpenChange={(v) => !v && setAccion(null)}
        title={accion ? textosAccion[accion].title : ""}
        description={accion ? textosAccion[accion].description : ""}
        confirmLabel={accion ? textosAccion[accion].confirmLabel : ""}
        cancelLabel={accion ? textosAccion[accion].cancelLabel : undefined}
        confirmIcon={
          accion === "activar" ? (
            <Rocket className="size-4" />
          ) : accion === "finalizar" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Ban className="size-4" />
          )
        }
        variant={accion === "cancelar" ? "destructive" : "default"}
        pending={cambiarEstado.isPending}
        onConfirm={confirmarAccion}
      />
    </div>
  );
}
