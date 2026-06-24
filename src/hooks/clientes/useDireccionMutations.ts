import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDireccion,
  updateDireccion,
  removeDireccion,
} from "@/services/clientes";
import type { DireccionFormValues } from "@/lib/types/cliente";

export function useDireccionMutations(clienteId: number | string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["clientes", clienteId] });
  };

  const add = useMutation({
    mutationFn: (dto: DireccionFormValues) => addDireccion(clienteId, dto),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      dirId,
      dto,
    }: {
      dirId: number | string;
      dto: Partial<DireccionFormValues>;
    }) => updateDireccion(clienteId, dirId, dto),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (dirId: number | string) => removeDireccion(clienteId, dirId),
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
