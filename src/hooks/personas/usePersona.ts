import { useQuery } from "@tanstack/react-query";
import { getPersona360 } from "@/services/personas";

export function usePersona(id: number | string | null | undefined) {
  return useQuery({
    queryKey: ["persona", id] as const,
    queryFn: () => getPersona360(id!),
    enabled: !!id,
  });
}
