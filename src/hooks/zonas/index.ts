import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createZone,
  deleteZone,
  duplicateZone,
  getPuestos,
  getZones,
  updateZone,
} from "@/services/zonas";
import type { ZonePayload } from "@/lib/types/zona";

export function usePuestos() {
  return useQuery({
    queryKey: ["zonas", "puestos"] as const,
    queryFn: () => getPuestos(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useZones(puestoId: number | null) {
  return useQuery({
    queryKey: ["zonas", puestoId] as const,
    queryFn: () => getZones(puestoId as number),
    enabled: puestoId !== null && puestoId > 0,
  });
}

export function useZoneMutations(puestoId: number | null) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["zonas", puestoId] });

  const create = useMutation({
    mutationFn: (payload: ZonePayload) => createZone(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<ZonePayload> }) =>
      updateZone(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteZone(id),
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: (id: number) => duplicateZone(id),
    onSuccess: invalidate,
  });

  return { create, update, remove, duplicate };
}
