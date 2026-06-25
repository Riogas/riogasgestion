import { api } from "@/lib/axios";
import type {
  MovilDetalle,
  MovilFiltros,
  MovilKpis,
  PaginatedMoviles,
  QueryMovilesParams,
} from "@/lib/types/movil";

export async function getMoviles(
  params?: QueryMovilesParams,
): Promise<PaginatedMoviles> {
  const { data } = await api.get<PaginatedMoviles>("/moviles", { params });
  return data;
}

export async function getMovilKpis(): Promise<MovilKpis> {
  const { data } = await api.get<MovilKpis>("/moviles/kpis");
  return data;
}

export async function getMovilFiltros(): Promise<MovilFiltros> {
  const { data } = await api.get<MovilFiltros>("/moviles/filtros");
  return data;
}

export async function getMovil(id: number | string): Promise<MovilDetalle> {
  const { data } = await api.get<MovilDetalle>(`/moviles/${id}`);
  return data;
}
