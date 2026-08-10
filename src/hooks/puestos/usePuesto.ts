import { useQuery } from "@tanstack/react-query";
import { obtenerPuesto } from "@/services/puestos";

export function usePuesto(id: number | null) {
  return useQuery({
    queryKey: ["puesto", id] as const,
    queryFn: () => obtenerPuesto(id as number),
    enabled: id !== null,
  });
}
