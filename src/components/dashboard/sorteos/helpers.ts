// Helpers del admin de Sorteos: formato es-UY, schema del form (crear/editar)
// y conversión entre <input type="datetime-local"> (hora local) e ISO 8601.

import { z } from "zod";
import { normalizarDepartamento } from "@/lib/geo-uy";
import type {
  CrearSorteoPayload,
  Sorteo,
  SorteoStatsPorDepartamento,
} from "@/lib/types/sorteo";

// ─── Tabs del detalle ───────────────────────────────────────────────────────
// Viven acá (y no en SorteoDetalle) para que las tabs hijas puedan navegar
// entre sí vía nuqs sin importar al padre (evita el import circular).

export const SORTEO_TABS = [
  "resumen",
  "codigos",
  "participantes",
  "ganadores",
  "config",
] as const;
export type SorteoTabValue = (typeof SORTEO_TABS)[number];

// ─── Formato ────────────────────────────────────────────────────────────────

export function fmtFechaHora(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function fmtFecha(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// `stats.porDia[].fecha` viene como "YYYY-MM-DD": se le agrega la hora para que
// el navegador lo interprete en hora local y no reste un día por el UTC.

/** "05/08" para los ejes de los charts (la serie ya viene ordenada por día). */
export function fmtDiaCorto(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return isNaN(d.getTime())
    ? fecha
    : d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
}

/** "05/08/2026" para el tooltip de los charts. */
export function fmtDiaLargo(fecha: string | null | undefined): string {
  return fecha ? fmtFecha(`${fecha}T00:00:00`) : "—";
}

export function fmtNumero(n: number | null | undefined): string {
  return typeof n === "number" ? n.toLocaleString("es-UY") : "—";
}

export function porcentaje(parte: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((parte / total) * 100));
}

// ─── Departamentos del gráfico ──────────────────────────────────────────────

/**
 * El backend agrupa por el string crudo, así que el mismo departamento llega
 * partido en dos filas cuando una vino del GPS ("Montevideo") y la otra del
 * geoip ("MO"). Acá se unifican, se suman y se separan las participaciones sin
 * ubicación, que no son un departamento y no van al gráfico.
 */
export function agruparDepartamentos(filas: SorteoStatsPorDepartamento[]): {
  series: SorteoStatsPorDepartamento[];
  sinUbicacion: number;
} {
  const acumulado = new Map<string, number>();
  let sinUbicacion = 0;

  for (const fila of filas) {
    const departamento = normalizarDepartamento(fila.departamento);
    if (!departamento) {
      sinUbicacion += fila.cantidad;
      continue;
    }
    acumulado.set(departamento, (acumulado.get(departamento) ?? 0) + fila.cantidad);
  }

  const series = Array.from(acumulado, ([departamento, cantidad]) => ({
    departamento,
    cantidad,
  })).sort((a, b) => b.cantidad - a.cantidad);

  return { series, sinUbicacion };
}

// ─── Fechas del form ────────────────────────────────────────────────────────

/** ISO → "2026-08-05T14:30" para <input type="datetime-local"> (hora local). */
export function isoADatetimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** El valor del datetime-local se interpreta en hora local y viaja en ISO/UTC. */
function datetimeLocalAIso(value: string): string {
  return new Date(value).toISOString();
}

// ─── Schema del form ────────────────────────────────────────────────────────
// Todos los campos son string: los <input type="number"> se convierten a número
// recién en `payloadDesdeValores`, así los mensajes de error quedan en español
// y no dependen del texto por defecto de zod para NaN.

function texto(min: number, max: number, corto: string) {
  return z
    .string()
    .refine((v) => v.trim().length >= min, corto)
    .refine((v) => v.trim().length <= max, `Máximo ${max} caracteres`);
}

function entero(min: number, max: number, vacio: string, rango: string) {
  return z
    .string()
    .refine((v) => v.trim().length > 0, vacio)
    .refine((v) => /^\d+$/.test(v.trim()), "Ingresá solo números enteros")
    .refine((v) => {
      const n = Number(v);
      return n >= min && n <= max;
    }, rango);
}

function fecha(vacio: string) {
  return z
    .string()
    .refine((v) => v.trim().length > 0, vacio)
    .refine((v) => !isNaN(Date.parse(v)), "Fecha inválida");
}

export const sorteoFormSchema = z
  .object({
    nombre: texto(3, 120, "El nombre debe tener al menos 3 caracteres"),
    descripcion: z.string().refine((v) => v.trim().length <= 500, "Máximo 500 caracteres"),
    premioDescripcion: texto(3, 300, "Describí el premio (mínimo 3 caracteres)"),
    fechaDesde: fecha("Indicá la fecha y hora de inicio"),
    fechaHasta: fecha("Indicá la fecha y hora de fin"),
    cantidadPremios: entero(
      1,
      100000,
      "Indicá cuántos premios se sortean",
      "La cantidad debe estar entre 1 y 100.000",
    ),
    maxRegistrosDispositivoDia: entero(
      1,
      100,
      "Indicá el máximo de registros por dispositivo",
      "El máximo por dispositivo debe estar entre 1 y 100",
    ),
    edadMinima: entero(1, 120, "Indicá la edad mínima", "La edad mínima debe estar entre 1 y 120"),
  })
  .refine(
    (v) =>
      !v.fechaDesde ||
      !v.fechaHasta ||
      isNaN(Date.parse(v.fechaDesde)) ||
      isNaN(Date.parse(v.fechaHasta)) ||
      Date.parse(v.fechaHasta) > Date.parse(v.fechaDesde),
    { message: "La fecha de fin debe ser posterior a la de inicio", path: ["fechaHasta"] },
  );

export type SorteoFormValues = z.infer<typeof sorteoFormSchema>;

export const SORTEO_FORM_DEFAULTS: SorteoFormValues = {
  nombre: "",
  descripcion: "",
  premioDescripcion: "",
  fechaDesde: "",
  fechaHasta: "",
  cantidadPremios: "1",
  maxRegistrosDispositivoDia: "3",
  edadMinima: "18",
};

export function valoresDesdeSorteo(s: Sorteo): SorteoFormValues {
  return {
    nombre: s.nombre,
    descripcion: s.descripcion ?? "",
    premioDescripcion: s.premioDescripcion,
    fechaDesde: isoADatetimeLocal(s.fechaDesde),
    fechaHasta: isoADatetimeLocal(s.fechaHasta),
    cantidadPremios: String(s.cantidadPremios),
    maxRegistrosDispositivoDia: String(s.maxRegistrosDispositivoDia),
    edadMinima: String(s.edadMinima),
  };
}

export function payloadDesdeValores(v: SorteoFormValues): CrearSorteoPayload {
  return {
    nombre: v.nombre.trim(),
    // "" borra la descripción en el PATCH y queda null en el POST.
    descripcion: v.descripcion.trim(),
    premioDescripcion: v.premioDescripcion.trim(),
    fechaDesde: datetimeLocalAIso(v.fechaDesde),
    fechaHasta: datetimeLocalAIso(v.fechaHasta),
    cantidadPremios: Number(v.cantidadPremios),
    maxRegistrosDispositivoDia: Number(v.maxRegistrosDispositivoDia),
    edadMinima: Number(v.edadMinima),
  };
}
