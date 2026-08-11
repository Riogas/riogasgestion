// Revisión de matches nomenclator↔OSM — API real /api/calles/* (NestJS).
// La cola viene ordenada por cantidad de clientes: lo que más duele, primero.

import { api } from "@/lib/axios";
import { getAuthToken } from "@/lib/authToken";
import type {
  CalleOsmDetalle,
  CalleSugerida,
  EstadoMatch,
  MapaMatch,
  MatchFila,
} from "@/lib/types/calleMatch";

const sinOverlay = { disableGlobalLoading: true } as const;

export async function getMatches(
  estado: EstadoMatch | "",
  take: number,
  skip: number,
): Promise<{ total: number; filas: MatchFila[] }> {
  const { data } = await api.get<{ total: number; filas: MatchFila[] }>(
    "/calles/matches",
    { params: { ...(estado ? { estado } : {}), take, skip }, ...sinOverlay },
  );
  return data;
}

export async function getMapaMatch(id: number): Promise<MapaMatch> {
  const { data } = await api.get<MapaMatch>(`/calles/matches/${id}/mapa`, {
    ...sinOverlay,
  });
  return data;
}

export async function revisarMatch(
  id: number,
  accion: "aprobar" | "rechazar" | "corregir",
  calleOsmId?: number,
): Promise<void> {
  await api.patch(`/calles/matches/${id}`, {
    accion,
    usuario: usuarioActual(),
    ...(calleOsmId ? { calleOsmId } : {}),
  });
}

/** Los puntos de una calle OSM: para pintar la candidata en el mapa. */
export async function getCalleOsm(id: number): Promise<CalleOsmDetalle> {
  const { data } = await api.get<CalleOsmDetalle>(`/calles/osm/${id}`, {
    ...sinOverlay,
  });
  return data;
}

/** Candidatas OSM para "corregir" — el mismo suggest que usa el VB6. */
export async function buscarCandidatas(
  q: string,
  depto?: string,
): Promise<CalleSugerida[]> {
  const { data } = await api.get<CalleSugerida[]>("/calles/buscar", {
    params: { q, ...(depto ? { depto } : {}) },
    ...sinOverlay,
  });
  return data;
}

/** El nombre del operador sale del JWT que emitió secapi. */
export function usuarioActual(): string {
  const token = getAuthToken();
  if (!token) return "panel";
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return String(payload.sub ?? payload.usuario ?? payload.name ?? "panel");
  } catch {
    return "panel";
  }
}
