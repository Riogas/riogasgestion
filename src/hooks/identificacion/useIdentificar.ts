import { useMutation } from "@tanstack/react-query";
import { identificar } from "@/services/identificacion";
import type { IdentificarParams } from "@/lib/types/persona";

// Lookup puntual — no se cachea (sin queryKey, sin invalidación).
export function useIdentificar() {
  return useMutation({
    mutationFn: (params: IdentificarParams) => identificar(params),
  });
}
