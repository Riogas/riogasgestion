import { api } from "@/lib/axios";
import type {
  IdentificarParams,
  IdentificarResultado,
} from "@/lib/types/persona";

// ─── Identificación del distribuidor ─────────────────────────────────────────

export async function identificar(
  p: IdentificarParams,
): Promise<IdentificarResultado> {
  const { data } = await api.post<IdentificarResultado>("/identificacion", p);
  return data;
}
