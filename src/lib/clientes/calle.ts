// Normalización de calles y comparación calle escrita vs. geoinversa.
// Mismo criterio que la feature de verificación de coordenadas (backfill).

export function normalizeCalle(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar diacríticos
    .toLowerCase()
    .replace(/\b(avenida|av|avda)\b/g, "")
    .replace(/\b(calle|cno|c)\b/g, "")
    .replace(/\b(camino|cno)\b/g, "")
    .replace(/\b(bvar|boulevard|bulevar)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compara la calle escrita por el usuario contra la calle del reverse-geocode.
 * Devuelve true/false si ambas están presentes, null si falta alguna (s/coord).
 */
export function calcCalleMatch(
  escrita: string | null | undefined,
  geoCalle: string | null | undefined,
): boolean | null {
  const a = normalizeCalle(escrita);
  const b = normalizeCalle(geoCalle);
  if (!a || !b) return null;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}
