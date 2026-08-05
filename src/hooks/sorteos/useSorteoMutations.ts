import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  activarSorteo,
  cancelarSorteo,
  crearLote,
  crearSorteo,
  descargarZipLote,
  exportarParticipacionesCsv,
  finalizarSorteo,
  marcarPremioEntregado,
  actualizarSorteo,
} from "@/services/sorteos";
import type { ActualizarSorteoPayload, CrearSorteoPayload } from "@/lib/types/sorteo";

export function useCrearSorteo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CrearSorteoPayload) => crearSorteo(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sorteos"] });
      toast.success("Sorteo creado");
    },
    onError: () => toast.error("Error al crear el sorteo"),
  });
}

export function useActualizarSorteo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ActualizarSorteoPayload }) =>
      actualizarSorteo(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sorteos"] });
      queryClient.invalidateQueries({ queryKey: ["sorteo", id] });
      toast.success("Sorteo actualizado");
    },
    onError: () => toast.error("Error al actualizar el sorteo"),
  });
}

type AccionEstadoSorteo = "activar" | "finalizar" | "cancelar";

const ACCIONES_ESTADO: Record<AccionEstadoSorteo, (id: number) => Promise<unknown>> = {
  activar: activarSorteo,
  finalizar: finalizarSorteo,
  cancelar: cancelarSorteo,
};

const MENSAJES_ESTADO: Record<AccionEstadoSorteo, string> = {
  activar: "Sorteo activado",
  finalizar: "Sorteo finalizado",
  cancelar: "Sorteo cancelado",
};

/** Cubre activar / finalizar / cancelar: mismas invalidaciones, distinta transición de estado. */
export function useCambiarEstadoSorteo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, accion }: { id: number; accion: AccionEstadoSorteo }) =>
      ACCIONES_ESTADO[accion](id),
    onSuccess: (_data, { id, accion }) => {
      queryClient.invalidateQueries({ queryKey: ["sorteos"] });
      queryClient.invalidateQueries({ queryKey: ["sorteo", id] });
      toast.success(MENSAJES_ESTADO[accion]);
    },
    onError: (_err, { accion }) => toast.error(`Error al ${accion} el sorteo`),
  });
}

export function useCrearLote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sorteoId, cantidad }: { sorteoId: number; cantidad: number }) =>
      crearLote(sorteoId, cantidad),
    onSuccess: (_data, { sorteoId }) => {
      queryClient.invalidateQueries({ queryKey: ["sorteo", sorteoId] });
      toast.success("Lote de códigos generado");
    },
    onError: () => toast.error("Error al generar el lote"),
  });
}

export function useMarcarEntregado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sorteoId,
      participacionId,
    }: {
      sorteoId: number;
      participacionId: number;
    }) => marcarPremioEntregado(participacionId),
    onSuccess: (_data, { sorteoId }) => {
      queryClient.invalidateQueries({ queryKey: ["sorteo", sorteoId] });
      toast.success("Premio marcado como entregado");
    },
    onError: () => toast.error("Error al marcar el premio como entregado"),
  });
}

export function useDescargarZipLote() {
  return useMutation({
    mutationFn: ({ sorteoId, loteId }: { sorteoId: number; loteId: number }) =>
      descargarZipLote(sorteoId, loteId),
    onError: () => toast.error("Error al descargar el ZIP del lote"),
  });
}

export function useDescargarCsvParticipaciones() {
  return useMutation({
    mutationFn: (sorteoId: number) => exportarParticipacionesCsv(sorteoId),
    onError: () => toast.error("Error al exportar las participaciones"),
  });
}
