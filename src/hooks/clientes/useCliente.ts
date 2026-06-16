import { useQuery } from "@tanstack/react-query";
import { getCliente } from "@/services/clientes";

export function useCliente(id: string | null | undefined) {
  return useQuery({
    queryKey: ["clientes", id] as const,
    queryFn: () => getCliente(id!),
    enabled: !!id,
  });
}
