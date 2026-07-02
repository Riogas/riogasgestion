// Servicio de Zonificación — API real /api/zonas (NestJS + Postgres goya).
// El backend espeja cada mutación en la tabla `zonas` del Supabase de
// TrackMovil (ver docs/superpowers/specs/2026-07-02-zonificacion-backend-sync-design.md).

import { api } from "@/lib/axios";
import type { Puesto, Zone, ZonePayload } from "@/lib/types/zona";

// GETs sin overlay global: la pantalla tiene skeletons propios.
const sinOverlay = { disableGlobalLoading: true } as const;

// La API usa nombres en español; el front trabaja en inglés (shape histórico
// de la pantalla). El mapeo vive acá y en ningún otro lado.
function toApiPayload(payload: Partial<ZonePayload>) {
  return {
    puestoId: payload.puestoId,
    nombre: payload.name,
    descripcion: payload.description,
    color: payload.color,
    tipoZona: payload.zoneType,
    servicios: payload.services,
    estado: payload.status,
    poligono: payload.polygon,
  };
}

export async function getPuestos(): Promise<Puesto[]> {
  const { data } = await api.get<Puesto[]>("/zonas/puestos", { ...sinOverlay });
  return data;
}

export async function getZones(puestoId: number): Promise<Zone[]> {
  const { data } = await api.get<Zone[]>("/zonas", {
    params: { puestoId },
    ...sinOverlay,
  });
  return data;
}

export async function createZone(payload: ZonePayload): Promise<Zone> {
  const { data } = await api.post<Zone>("/zonas", toApiPayload(payload));
  return data;
}

export async function updateZone(
  id: number,
  patch: Partial<ZonePayload>,
): Promise<Zone> {
  const body = Object.fromEntries(
    Object.entries(toApiPayload(patch)).filter(([, v]) => v !== undefined),
  );
  const { data } = await api.patch<Zone>(`/zonas/${id}`, body);
  return data;
}

export async function deleteZone(id: number): Promise<void> {
  await api.delete(`/zonas/${id}`);
}

export async function duplicateZone(id: number): Promise<Zone> {
  const { data } = await api.post<Zone>(`/zonas/${id}/duplicar`);
  return data;
}

// ─── Sincro con TrackMovil (uso puntual/ops) ──────────────────────────────────

export async function syncPull(): Promise<{
  total?: number;
  created?: number;
  updated?: number;
  skipped?: number[];
  error?: string;
}> {
  const { data } = await api.post("/zonas/sync/pull");
  return data;
}

export async function syncPush(): Promise<{
  procesadas: number;
  ok: number;
  error: number;
}> {
  const { data } = await api.post("/zonas/sync/push");
  return data;
}
