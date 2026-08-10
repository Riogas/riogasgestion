// Servicio de Puestos — API real /api/puestos (NestJS + Postgres goya).
// Rutas y shapes espejados de `backend/src/puestos/puestos.controller.ts`.

import { api } from "@/lib/axios";
import type {
  ActualizarPuestoPayload,
  CrearPuestoPayload,
  PaginatedPuestos,
  Puesto,
  PuestoDetalle,
  PuestoKpis,
  PuestosFiltrosData,
  QueryPuestosParams,
} from "@/lib/types/puesto";

// Los GET no levantan el overlay global: la pantalla tiene skeletons propios.
const sinOverlay = { disableGlobalLoading: true } as const;

export async function listarPuestos(
  params?: QueryPuestosParams,
): Promise<PaginatedPuestos> {
  const { data } = await api.get<PaginatedPuestos>("/puestos", {
    params,
    ...sinOverlay,
  });
  return data;
}

export async function obtenerKpisPuestos(): Promise<PuestoKpis> {
  const { data } = await api.get<PuestoKpis>("/puestos/kpis", sinOverlay);
  return data;
}

export async function obtenerFiltrosPuestos(): Promise<PuestosFiltrosData> {
  const { data } = await api.get<PuestosFiltrosData>("/puestos/filtros", sinOverlay);
  return data;
}

export async function obtenerPuesto(id: number): Promise<PuestoDetalle> {
  const { data } = await api.get<PuestoDetalle>(`/puestos/${id}`, sinOverlay);
  return data;
}

export async function crearPuesto(payload: CrearPuestoPayload): Promise<Puesto> {
  const { data } = await api.post<Puesto>("/puestos", payload);
  return data;
}

export async function actualizarPuesto(
  id: number,
  payload: ActualizarPuestoPayload,
): Promise<Puesto> {
  const { data } = await api.patch<Puesto>(`/puestos/${id}`, payload);
  return data;
}
