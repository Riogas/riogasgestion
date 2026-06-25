import { api } from "@/lib/axios";
import type {
  FleteraDetalle,
  FleteraFiltros,
  FleteraKpis,
  PaginatedFleteras,
  QueryFleterasParams,
} from "@/lib/types/fletera";

export async function getFleteras(
  params?: QueryFleterasParams,
): Promise<PaginatedFleteras> {
  const { data } = await api.get<PaginatedFleteras>("/fleteras", { params });
  return data;
}

export async function getFleteraKpis(): Promise<FleteraKpis> {
  const { data } = await api.get<FleteraKpis>("/fleteras/kpis");
  return data;
}

export async function getFleteraFiltros(): Promise<FleteraFiltros> {
  const { data } = await api.get<FleteraFiltros>("/fleteras/filtros");
  return data;
}

export async function getFletera(
  id: number | string,
): Promise<FleteraDetalle> {
  const { data } = await api.get<FleteraDetalle>(`/fleteras/${id}`);
  return data;
}
