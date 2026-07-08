import { useQuery } from "@tanstack/react-query";
import { getSugerencias } from "@/services/workbench";
import type { QuerySugerenciasParams } from "@/lib/types/persona";

/**
 * ADVERTENCIA: `params` debe estar memoizado con useMemo() en el componente
 * que llame a este hook. Si se pasa un objeto literal nuevo en cada render,
 * la queryKey cambiará en cada render y provocará un refetch infinito.
 *
 * @example
 * const params = useMemo(() => ({ tipo, estado, page }), [tipo, estado, page]);
 * const { data } = useSugerencias(params);
 */
export function useSugerencias(params?: QuerySugerenciasParams) {
  return useQuery({
    queryKey: ["sugerencias", params] as const,
    queryFn: () => getSugerencias(params),
    placeholderData: (prev) => prev,
  });
}
