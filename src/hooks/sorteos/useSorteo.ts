import { useQuery } from "@tanstack/react-query";
import { getSorteo } from "@/services/sorteos";

export function useSorteo(id: number | string | null | undefined) {
  return useQuery({
    queryKey: ["sorteo", id] as const,
    queryFn: () => getSorteo(Number(id)),
    enabled: id != null,
  });
}
