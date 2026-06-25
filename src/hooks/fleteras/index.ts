import { useQuery } from "@tanstack/react-query";
import {
  getFleteras,
  getFletera,
  getFleteraKpis,
  getFleteraFiltros,
} from "@/services/fleteras";
import type { QueryFleterasParams } from "@/lib/types/fletera";

export function useFleteras(params: QueryFleterasParams) {
  return useQuery({
    queryKey: ["fleteras", params] as const,
    queryFn: () => getFleteras(params),
  });
}

export function useFletera(id: number | string | null | undefined) {
  return useQuery({
    queryKey: ["fleteras", "detalle", id] as const,
    queryFn: () => getFletera(id!),
    enabled: !!id,
  });
}

export function useFleteraKpis() {
  return useQuery({
    queryKey: ["fleteras", "kpis"] as const,
    queryFn: () => getFleteraKpis(),
  });
}

export function useFleteraFiltros() {
  return useQuery({
    queryKey: ["fleteras", "filtros"] as const,
    queryFn: () => getFleteraFiltros(),
  });
}
