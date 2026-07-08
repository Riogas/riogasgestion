import { api } from "@/lib/axios";
import type {
  MatchSugerencia,
  PaginatedSugerencias,
  QuerySugerenciasParams,
} from "@/lib/types/persona";

// ─── Workbench de deduplicación ───────────────────────────────────────────────

export async function getSugerencias(
  params?: QuerySugerenciasParams,
): Promise<PaginatedSugerencias> {
  const { data } = await api.get<PaginatedSugerencias>(
    "/workbench/sugerencias",
    { params },
  );
  return data;
}

export async function aceptarSugerencia(
  id: number | string,
): Promise<MatchSugerencia> {
  const { data } = await api.post<MatchSugerencia>(
    `/workbench/sugerencias/${id}/aceptar`,
  );
  return data;
}

export async function rechazarSugerencia(
  id: number | string,
): Promise<MatchSugerencia> {
  const { data } = await api.post<MatchSugerencia>(
    `/workbench/sugerencias/${id}/rechazar`,
  );
  return data;
}

export async function deshacerSugerencia(
  id: number | string,
): Promise<MatchSugerencia> {
  const { data } = await api.post<MatchSugerencia>(
    `/workbench/sugerencias/${id}/deshacer`,
  );
  return data;
}
