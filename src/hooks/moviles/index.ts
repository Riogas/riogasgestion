import { useQuery } from "@tanstack/react-query";
import {
  getMoviles,
  getMovil,
  getMovilKpis,
  getMovilFiltros,
} from "@/services/moviles";
import type { QueryMovilesParams } from "@/lib/types/movil";

export function useMoviles(params: QueryMovilesParams) {
  return useQuery({
    queryKey: ["moviles", params] as const,
    queryFn: () => getMoviles(params),
  });
}

export function useMovil(id: number | string | null | undefined) {
  return useQuery({
    queryKey: ["moviles", "detalle", id] as const,
    queryFn: () => getMovil(id!),
    enabled: !!id,
  });
}

export function useMovilKpis() {
  return useQuery({
    queryKey: ["moviles", "kpis"] as const,
    queryFn: () => getMovilKpis(),
  });
}

export function useMovilFiltros() {
  return useQuery({
    queryKey: ["moviles", "filtros"] as const,
    queryFn: () => getMovilFiltros(),
  });
}
