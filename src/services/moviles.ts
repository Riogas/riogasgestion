import { api } from "@/lib/axios";
import type {
  MovilCatalogos,
  MovilDetalle,
  MovilEscenario,
  MovilFiltros,
  MovilKpis,
  MovilProducto,
  MovilPunto,
  MovilServicioItem,
  PaginatedMoviles,
  QueryMovilesParams,
  EscenarioPayload,
  ProductoPayload,
  PuntoPayload,
  ServicioPayload,
  UpdateMovilPayload,
} from "@/lib/types/movil";

// Los GET de móviles no prenden el overlay global de "Cargando..." (la
// pantalla ya muestra skeletons propios; el overlay solo tapa la app).
const sinOverlay = { disableGlobalLoading: true } as const;

export async function getMoviles(
  params?: QueryMovilesParams,
): Promise<PaginatedMoviles> {
  const { data } = await api.get<PaginatedMoviles>("/moviles", {
    params,
    ...sinOverlay,
  });
  return data;
}

export async function getMovilKpis(): Promise<MovilKpis> {
  const { data } = await api.get<MovilKpis>("/moviles/kpis", { ...sinOverlay });
  return data;
}

export async function getMovilFiltros(): Promise<MovilFiltros> {
  const { data } = await api.get<MovilFiltros>("/moviles/filtros", {
    ...sinOverlay,
  });
  return data;
}

export async function getMovilCatalogos(): Promise<MovilCatalogos> {
  const { data } = await api.get<MovilCatalogos>("/moviles/catalogos", {
    ...sinOverlay,
  });
  return data;
}

export async function getMovil(id: number | string): Promise<MovilDetalle> {
  const { data } = await api.get<MovilDetalle>(`/moviles/${id}`, {
    ...sinOverlay,
  });
  return data;
}

export async function updateMovil(
  id: number | string,
  dto: UpdateMovilPayload,
): Promise<MovilDetalle> {
  const { data } = await api.patch<MovilDetalle>(`/moviles/${id}`, dto);
  return data;
}

export async function duplicarMovil(
  id: number | string,
): Promise<{ id: number }> {
  const { data } = await api.post<{ id: number }>(`/moviles/${id}/duplicar`);
  return data;
}

// ─── Sub-recursos ───────────────────────────────────────────────────────────────

export async function addProducto(
  movilId: number | string,
  dto: ProductoPayload,
): Promise<MovilProducto> {
  const { data } = await api.post(`/moviles/${movilId}/productos`, dto);
  return data;
}

export async function updateProducto(
  movilId: number | string,
  subId: number | string,
  dto: ProductoPayload,
): Promise<MovilProducto> {
  const { data } = await api.patch(`/moviles/${movilId}/productos/${subId}`, dto);
  return data;
}

export async function removeProducto(
  movilId: number | string,
  subId: number | string,
): Promise<void> {
  await api.delete(`/moviles/${movilId}/productos/${subId}`);
}

export async function addPunto(
  movilId: number | string,
  dto: PuntoPayload,
): Promise<MovilPunto> {
  const { data } = await api.post(`/moviles/${movilId}/puntos`, dto);
  return data;
}

export async function updatePunto(
  movilId: number | string,
  subId: number | string,
  dto: PuntoPayload,
): Promise<MovilPunto> {
  const { data } = await api.patch(`/moviles/${movilId}/puntos/${subId}`, dto);
  return data;
}

export async function removePunto(
  movilId: number | string,
  subId: number | string,
): Promise<void> {
  await api.delete(`/moviles/${movilId}/puntos/${subId}`);
}

export async function addServicio(
  movilId: number | string,
  dto: ServicioPayload,
): Promise<MovilServicioItem> {
  const { data } = await api.post(`/moviles/${movilId}/servicios`, dto);
  return data;
}

export async function removeServicio(
  movilId: number | string,
  subId: number | string,
): Promise<void> {
  await api.delete(`/moviles/${movilId}/servicios/${subId}`);
}

export async function addEscenario(
  movilId: number | string,
  dto: EscenarioPayload,
): Promise<MovilEscenario> {
  const { data } = await api.post(`/moviles/${movilId}/escenarios`, dto);
  return data;
}

export async function updateEscenario(
  movilId: number | string,
  subId: number | string,
  dto: EscenarioPayload,
): Promise<MovilEscenario> {
  const { data } = await api.patch(`/moviles/${movilId}/escenarios/${subId}`, dto);
  return data;
}

export async function removeEscenario(
  movilId: number | string,
  subId: number | string,
): Promise<void> {
  await api.delete(`/moviles/${movilId}/escenarios/${subId}`);
}
