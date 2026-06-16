import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCliente,
  updateCliente,
  deleteCliente,
} from "@/services/clientes";
import type { Cliente, ClienteFormValues, CreateClienteFormValues } from "@/lib/types/cliente";

export function useCreateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateClienteFormValues) => createCliente(dto),
    onSuccess: () => {
      // Invalidate the list so it refetches
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useUpdateCliente(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: Partial<ClienteFormValues>) => updateCliente(id, dto),

    // Optimistic update
    onMutate: async (dto) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["clientes", id] });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<Cliente>(["clientes", id]);

      // Optimistically update the cache
      if (previous) {
        queryClient.setQueryData<Cliente>(["clientes", id], {
          ...previous,
          ...dto,
        });
      }

      return { previous };
    },

    onError: (_err, _dto, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData<Cliente>(["clientes", id], context.previous);
      }
    },

    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["clientes", id] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useDeleteCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCliente(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["clientes", id] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}
