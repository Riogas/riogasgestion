// Servicio de Sorteos (admin) — API real /api/sorteos (NestJS + Postgres goya).
// Rutas y shapes espejados de `backend/src/sorteos/sorteos-admin.controller.ts`.

import { api } from "@/lib/axios";
import type {
  ActualizarSorteoPayload,
  CrearSorteoPayload,
  PaginatedParticipaciones,
  PaginatedSorteos,
  QuerySorteoParticipacionesParams,
  QuerySorteosParams,
  Sorteo,
  SorteoDetalle,
  SorteoLote,
  SorteoLoteCreado,
  SorteoParticipacion,
} from "@/lib/types/sorteo";

// GETs sin overlay global: las pantallas de admin tienen skeletons propios.
const sinOverlay = { disableGlobalLoading: true } as const;

/** Dispara la descarga de un blob en el navegador y libera la URL creada. */
function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sorteos ────────────────────────────────────────────────────────────────

export async function listarSorteos(
  params?: QuerySorteosParams,
): Promise<PaginatedSorteos> {
  const { data } = await api.get<PaginatedSorteos>("/sorteos", {
    params,
    ...sinOverlay,
  });
  return data;
}

export async function crearSorteo(payload: CrearSorteoPayload): Promise<Sorteo> {
  const { data } = await api.post<Sorteo>("/sorteos", payload);
  return data;
}

export async function getSorteo(id: number): Promise<SorteoDetalle> {
  const { data } = await api.get<SorteoDetalle>(`/sorteos/${id}`, { ...sinOverlay });
  return data;
}

export async function actualizarSorteo(
  id: number,
  payload: ActualizarSorteoPayload,
): Promise<Sorteo> {
  const { data } = await api.patch<Sorteo>(`/sorteos/${id}`, payload);
  return data;
}

export async function activarSorteo(id: number): Promise<Sorteo> {
  const { data } = await api.post<Sorteo>(`/sorteos/${id}/activar`);
  return data;
}

export async function finalizarSorteo(id: number): Promise<Sorteo> {
  const { data } = await api.post<Sorteo>(`/sorteos/${id}/finalizar`);
  return data;
}

export async function cancelarSorteo(id: number): Promise<Sorteo> {
  const { data } = await api.post<Sorteo>(`/sorteos/${id}/cancelar`);
  return data;
}

// ─── Lotes de códigos ───────────────────────────────────────────────────────

export async function crearLote(id: number, cantidad: number): Promise<SorteoLoteCreado> {
  const { data } = await api.post<SorteoLoteCreado>(`/sorteos/${id}/lotes`, { cantidad });
  return data;
}

export async function listarLotes(id: number): Promise<SorteoLote[]> {
  const { data } = await api.get<SorteoLote[]>(`/sorteos/${id}/lotes`, { ...sinOverlay });
  return data;
}

/** Descarga el ZIP de QRs del lote (requiere Authorization, por eso no es un link directo). */
export async function descargarZipLote(sorteoId: number, loteId: number): Promise<void> {
  const { data } = await api.get<Blob>(`/sorteos/${sorteoId}/lotes/${loteId}/zip`, {
    responseType: "blob",
  });
  descargarBlob(data, `sorteo-${sorteoId}-lote-${loteId}.zip`);
}

// ─── Participaciones ────────────────────────────────────────────────────────

export async function listarParticipaciones(
  id: number,
  params?: QuerySorteoParticipacionesParams,
): Promise<PaginatedParticipaciones> {
  const { data } = await api.get<PaginatedParticipaciones>(
    `/sorteos/${id}/participaciones`,
    { params, ...sinOverlay },
  );
  return data;
}

/** Descarga el CSV de participaciones (requiere Authorization, por eso no es un link directo). */
export async function exportarParticipacionesCsv(id: number): Promise<void> {
  const { data } = await api.get<Blob>(`/sorteos/${id}/participaciones/export`, {
    responseType: "blob",
  });
  descargarBlob(data, `sorteo-${id}-participaciones.csv`);
}

export async function marcarPremioEntregado(
  participacionId: number,
): Promise<SorteoParticipacion> {
  const { data } = await api.post<SorteoParticipacion>(
    `/sorteos/participaciones/${participacionId}/entregar`,
  );
  return data;
}
