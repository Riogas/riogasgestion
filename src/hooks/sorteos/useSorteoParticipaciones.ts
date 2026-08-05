import { useQuery } from "@tanstack/react-query";
import { listarParticipaciones } from "@/services/sorteos";
import type { QuerySorteoParticipacionesParams } from "@/lib/types/sorteo";

/**
 * ADVERTENCIA: `params` debe estar memoizado con useMemo() en el componente
 * que llame a este hook. Si se pasa un objeto literal nuevo en cada render,
 * la queryKey cambiará en cada render y provocará un refetch infinito.
 *
 * @example
 * const params = useMemo(() => ({ page, search, soloGanadores }), [page, search, soloGanadores]);
 * const { data } = useSorteoParticipaciones(sorteoId, params);
 */
export function useSorteoParticipaciones(
  sorteoId: number | string | null | undefined,
  params?: QuerySorteoParticipacionesParams,
) {
  return useQuery({
    queryKey: ["sorteo", sorteoId, "participaciones", params] as const,
    queryFn: () => listarParticipaciones(Number(sorteoId), params),
    enabled: sorteoId != null,
    placeholderData: (prev) => prev,
  });
}
