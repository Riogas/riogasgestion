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

/** Minuto de gracia antes de liberar la object URL: Firefox aborta la descarga
 *  si se revoca apenas se dispara el click y el archivo es grande. */
const REVOCAR_URL_MS = 60000;

/** Dispara la descarga de un blob en el navegador y libera la URL creada. */
function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOCAR_URL_MS);
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
  // Sin overlay: generar 10.000 códigos tarda, y el diálogo ya muestra su
  // propio estado "Generando…" con los botones bloqueados.
  const { data } = await api.post<SorteoLoteCreado>(
    `/sorteos/${id}/lotes`,
    { cantidad },
    { ...sinOverlay },
  );
  return data;
}

export async function listarLotes(id: number): Promise<SorteoLote[]> {
  const { data } = await api.get<SorteoLote[]>(`/sorteos/${id}/lotes`, { ...sinOverlay });
  return data;
}

/**
 * Descarga el ZIP de QRs del lote (requiere Authorization, por eso no es un
 * link directo). Va por `/api/sorteos-descarga`, la ruta que pipea el body sin
 * bufferearlo en el proceso Next, y sin overlay global: la pantalla muestra el
 * progreso en el propio botón.
 */
export async function descargarZipLote(sorteoId: number, loteId: number): Promise<void> {
  const { data } = await api.get<Blob>(
    `/sorteos-descarga/${sorteoId}/lotes/${loteId}/zip`,
    { responseType: "blob", ...sinOverlay },
  );
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

/**
 * Descarga el CSV con TODAS las participaciones del sorteo (el endpoint no
 * acepta filtros: la UI lo dice explícitamente). Misma ruta de streaming y
 * mismo criterio de overlay que el ZIP.
 */
export async function exportarParticipacionesCsv(id: number): Promise<void> {
  const { data } = await api.get<Blob>(
    `/sorteos-descarga/${id}/participaciones/export`,
    { responseType: "blob", ...sinOverlay },
  );
  descargarBlob(data, `sorteo-${id}-participaciones.csv`);
}

export async function marcarPremioEntregado(
  participacionId: number,
): Promise<SorteoParticipacion> {
  const { data } = await api.post<SorteoParticipacion>(
    `/sorteos/participaciones/${participacionId}/entregar`,
    undefined,
    { ...sinOverlay },
  );
  return data;
}
