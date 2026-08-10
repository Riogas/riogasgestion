import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { actualizarPuesto, crearPuesto } from "@/services/puestos";
import type {
  ActualizarPuestoPayload,
  CrearPuestoPayload,
} from "@/lib/types/puesto";

/**
 * El backend devuelve mensajes accionables (id repetido, coordenada a medias,
 * email inválido). Mostrarlos tal cual evita el clásico "Error al guardar" que
 * obliga a abrir la consola para saber qué pasó.
 */
function mensajeDeError(error: unknown, fallback: string): string {
  const data = (error as AxiosError<{ message?: string | string[] }>)?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg) && msg.length > 0) return msg[0];
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export function useCrearPuesto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CrearPuestoPayload) => crearPuesto(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["puestos"] });
      toast.success("Puesto creado correctamente.");
    },
    onError: (error) =>
      toast.error(mensajeDeError(error, "No se pudo crear el puesto.")),
  });
}

export function useActualizarPuesto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ActualizarPuestoPayload }) =>
      actualizarPuesto(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["puestos"] });
      queryClient.invalidateQueries({ queryKey: ["puesto", id] });
      toast.success("Puesto actualizado correctamente.");
    },
    onError: (error) =>
      toast.error(mensajeDeError(error, "No se pudo actualizar el puesto.")),
  });
}
