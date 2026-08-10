import { useQuery } from "@tanstack/react-query";
import { listarPuestos } from "@/services/puestos";
import type { QueryPuestosParams } from "@/lib/types/puesto";

/**
 * ADVERTENCIA: `params` debe estar memoizado con useMemo() en el componente
 * que llame a este hook. Un objeto literal nuevo en cada render cambia la
 * queryKey y dispara un refetch infinito.
 */
export function usePuestos(params?: QueryPuestosParams) {
  return useQuery({
    queryKey: ["puestos", params] as const,
    queryFn: () => listarPuestos(params),
    placeholderData: (prev) => prev,
  });
}
