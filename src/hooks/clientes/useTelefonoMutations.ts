import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTelefono,
  updateTelefono,
  removeTelefono,
} from "@/services/clientes";
import type { TelefonoFormValues } from "@/lib/types/cliente";

export function useTelefonoMutations(clienteId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["clientes", clienteId] });
  };

  const add = useMutation({
    mutationFn: (dto: TelefonoFormValues) => addTelefono(clienteId, dto),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ telId, dto }: { telId: string; dto: Partial<TelefonoFormValues> }) =>
      updateTelefono(clienteId, telId, dto),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (telId: string) => removeTelefono(clienteId, telId),
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
