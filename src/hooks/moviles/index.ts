import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMoviles,
  getMovil,
  getMovilKpis,
  getMovilFiltros,
  getMovilCatalogos,
  updateMovil,
  duplicarMovil,
  addProducto,
  updateProducto,
  removeProducto,
  addPunto,
  updatePunto,
  removePunto,
  addServicio,
  removeServicio,
  addEscenario,
  updateEscenario,
  removeEscenario,
} from "@/services/moviles";
import type {
  QueryMovilesParams,
  UpdateMovilPayload,
  ProductoPayload,
  PuntoPayload,
  ServicioPayload,
  EscenarioPayload,
} from "@/lib/types/movil";

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
    // KPIs casi estáticos: evita refetch en cada visita a la pantalla.
    staleTime: 60 * 1000,
  });
}

export function useMovilFiltros() {
  return useQuery({
    queryKey: ["moviles", "filtros"] as const,
    queryFn: () => getMovilFiltros(),
    // Catálogo de filtros: cambia muy poco.
    staleTime: 5 * 60 * 1000,
  });
}

export function useMovilCatalogos() {
  return useQuery({
    queryKey: ["moviles", "catalogos"] as const,
    queryFn: () => getMovilCatalogos(),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutaciones del detalle ─────────────────────────────────────────────────────

export function useMovilMutations(id: number | string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["moviles", "detalle", id] });
    queryClient.invalidateQueries({ queryKey: ["moviles", "detalle", Number(id)] });
  };

  const update = useMutation({
    mutationFn: (dto: UpdateMovilPayload) => updateMovil(id, dto),
    onSuccess: invalidate,
  });

  const duplicar = useMutation({
    mutationFn: () => duplicarMovil(id),
  });

  const productoAdd = useMutation({
    mutationFn: (dto: ProductoPayload) => addProducto(id, dto),
    onSuccess: invalidate,
  });
  const productoUpdate = useMutation({
    mutationFn: ({ subId, dto }: { subId: number; dto: ProductoPayload }) =>
      updateProducto(id, subId, dto),
    onSuccess: invalidate,
  });
  const productoRemove = useMutation({
    mutationFn: (subId: number) => removeProducto(id, subId),
    onSuccess: invalidate,
  });

  const puntoAdd = useMutation({
    mutationFn: (dto: PuntoPayload) => addPunto(id, dto),
    onSuccess: invalidate,
  });
  const puntoUpdate = useMutation({
    mutationFn: ({ subId, dto }: { subId: number; dto: PuntoPayload }) =>
      updatePunto(id, subId, dto),
    onSuccess: invalidate,
  });
  const puntoRemove = useMutation({
    mutationFn: (subId: number) => removePunto(id, subId),
    onSuccess: invalidate,
  });

  const servicioAdd = useMutation({
    mutationFn: (dto: ServicioPayload) => addServicio(id, dto),
    onSuccess: invalidate,
  });
  const servicioRemove = useMutation({
    mutationFn: (subId: number) => removeServicio(id, subId),
    onSuccess: invalidate,
  });

  const escenarioAdd = useMutation({
    mutationFn: (dto: EscenarioPayload) => addEscenario(id, dto),
    onSuccess: invalidate,
  });
  const escenarioUpdate = useMutation({
    mutationFn: ({ subId, dto }: { subId: number; dto: EscenarioPayload }) =>
      updateEscenario(id, subId, dto),
    onSuccess: invalidate,
  });
  const escenarioRemove = useMutation({
    mutationFn: (subId: number) => removeEscenario(id, subId),
    onSuccess: invalidate,
  });

  return {
    update,
    duplicar,
    productoAdd,
    productoUpdate,
    productoRemove,
    puntoAdd,
    puntoUpdate,
    puntoRemove,
    servicioAdd,
    servicioRemove,
    escenarioAdd,
    escenarioUpdate,
    escenarioRemove,
  };
}
