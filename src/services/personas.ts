import { api } from "@/lib/axios";
import type {
  Persona,
  Persona360,
  SetCanonicalParams,
} from "@/lib/types/persona";

// ─── Personas — vista 360 y resolución de identidad ──────────────────────────

export async function getPersona360(id: number | string): Promise<Persona360> {
  const { data } = await api.get<Persona360>(`/personas/${id}`);
  return data;
}

export async function setCanonical(
  id: number | string,
  dto: SetCanonicalParams,
): Promise<Persona> {
  const { data } = await api.patch<Persona>(`/personas/${id}/canonical`, dto);
  return data;
}

export async function unify(
  registroIds: number[],
): Promise<{ personaId: number }> {
  const { data } = await api.post<{ personaId: number }>("/personas/unify", {
    registroIds,
  });
  return data;
}

export async function split(
  registroIds: number[],
): Promise<{ nuevas: number[] }> {
  const { data } = await api.post<{ nuevas: number[] }>("/personas/split", {
    registroIds,
  });
  return data;
}
