import { useQuery } from "@tanstack/react-query";
import { listarLotes } from "@/services/sorteos";

export function useSorteoLotes(sorteoId: number | string | null | undefined) {
  return useQuery({
    queryKey: ["sorteo", sorteoId, "lotes"] as const,
    queryFn: () => listarLotes(Number(sorteoId)),
    enabled: sorteoId != null,
  });
}
