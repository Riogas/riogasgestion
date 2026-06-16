import { useQuery } from "@tanstack/react-query";
import { getClientes } from "@/services/clientes";
import type { QueryClientesParams } from "@/lib/types/cliente";

/**
 * ADVERTENCIA: `params` debe estar memoizado con useMemo() en el componente
 * que llame a este hook. Si se pasa un objeto literal nuevo en cada render,
 * la queryKey cambiará en cada render y provocará un refetch infinito.
 *
 * @example
 * const params = useMemo(() => ({ page, search }), [page, search]);
 * const { data } = useClientes(params);
 */
export function useClientes(params?: QueryClientesParams) {
  return useQuery({
    queryKey: ["clientes", params] as const,
    queryFn: () => getClientes(params),
    placeholderData: (prev) => prev,
  });
}
