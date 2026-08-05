import { useQuery } from "@tanstack/react-query";
import { listarSorteos } from "@/services/sorteos";
import type { QuerySorteosParams } from "@/lib/types/sorteo";

/**
 * ADVERTENCIA: `params` debe estar memoizado con useMemo() en el componente
 * que llame a este hook. Si se pasa un objeto literal nuevo en cada render,
 * la queryKey cambiará en cada render y provocará un refetch infinito.
 *
 * @example
 * const params = useMemo(() => ({ page, search, estado }), [page, search, estado]);
 * const { data } = useSorteos(params);
 */
export function useSorteos(params?: QuerySorteosParams) {
  return useQuery({
    queryKey: ["sorteos", params] as const,
    queryFn: () => listarSorteos(params),
    placeholderData: (prev) => prev,
  });
}
