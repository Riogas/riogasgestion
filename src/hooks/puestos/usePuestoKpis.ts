import { useQuery } from "@tanstack/react-query";
import { obtenerFiltrosPuestos, obtenerKpisPuestos } from "@/services/puestos";

export function usePuestoKpis() {
  return useQuery({
    queryKey: ["puestos", "kpis"] as const,
    queryFn: obtenerKpisPuestos,
  });
}

export function usePuestoFiltros() {
  return useQuery({
    queryKey: ["puestos", "filtros"] as const,
    queryFn: obtenerFiltrosPuestos,
    staleTime: 5 * 60 * 1000, // catálogo estable: no vale la pena refetchear
  });
}
