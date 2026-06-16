import { useQuery } from "@tanstack/react-query";
import { getClientes } from "@/services/clientes";
import type { QueryClientesParams } from "@/lib/types/cliente";

export function useClientes(params?: QueryClientesParams) {
  return useQuery({
    queryKey: ["clientes", params] as const,
    queryFn: () => getClientes(params),
    placeholderData: (prev) => prev,
  });
}
