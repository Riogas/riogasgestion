import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setCanonical, unify, split } from "@/services/personas";
import type { SetCanonicalParams } from "@/lib/types/persona";

export function usePersonaMutations(id: number | string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["persona", id] });
    queryClient.invalidateQueries({ queryKey: ["clientes"] });
  };

  const setCanonicalMutation = useMutation({
    mutationFn: (dto: SetCanonicalParams) => setCanonical(id, dto),
    onSuccess: () => {
      invalidate();
      toast.success("Datos canónicos actualizados");
    },
    onError: () => toast.error("Error al actualizar los datos canónicos"),
  });

  const unifyMutation = useMutation({
    mutationFn: (registroIds: number[]) => unify(registroIds),
    onSuccess: () => {
      invalidate();
      toast.success("Registros unificados");
    },
    onError: () => toast.error("Error al unificar los registros"),
  });

  const splitMutation = useMutation({
    mutationFn: (registroIds: number[]) => split(registroIds),
    onSuccess: () => {
      invalidate();
      toast.success("Registros separados");
    },
    onError: () => toast.error("Error al separar los registros"),
  });

  return {
    setCanonical: setCanonicalMutation,
    unify: unifyMutation,
    split: splitMutation,
  };
}
