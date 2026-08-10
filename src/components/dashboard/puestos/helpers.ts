// Helpers de la pantalla de Puestos: normalización del legado, formato es-UY,
// paleta de badges y schema del formulario.

import { z } from "zod";
import type { Puesto } from "@/lib/types/puesto";

/** `puesto.zonaId` usa 0 como "sin zona" (sentinela del AS400), no NULL. */
export const SIN_ZONA = 0;

/** Lo que se muestra cuando un dato no está cargado. */
export const VACIO = "—";

// ─── Normalización del legado ───────────────────────────────────────────────

/** 'A' → Activo, 'P' → Pasivo, cualquier otra cosa → "—". */
export function mapEstado(estado?: string | null): string {
  const v = (estado ?? "").trim().toUpperCase();
  if (v === "A" || v === "ACTIVO") return "Activo";
  if (v === "P" || v === "PASIVO" || v === "I" || v === "INACTIVO") return "Pasivo";
  return VACIO;
}

export function esActivo(estado?: string | null): boolean {
  return (estado ?? "").trim().toUpperCase() === "A";
}

/**
 * Los flags del legado llegan en formatos variados según de qué AS400 vengan.
 * null/undefined/vacío NO es "No": es "no cargado", y se muestra como "—".
 */
export function mapBoolean(value?: string | boolean | null): string {
  if (value === null || value === undefined) return VACIO;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  const v = value.trim().toUpperCase();
  if (v === "") return VACIO;
  if (["S", "SI", "SÍ", "1", "Y", "YES", "TRUE"].includes(v)) return "Sí";
  if (["N", "NO", "0", "FALSE"].includes(v)) return "No";
  return VACIO;
}

/** Para inicializar switches del formulario desde el valor guardado. */
export function flagABoolean(value?: string | null): boolean {
  return mapBoolean(value) === "Sí";
}

export function formatNullable(value?: string | number | null): string {
  if (value === null || value === undefined) return VACIO;
  const s = String(value).trim();
  return s === "" ? VACIO : s;
}

/** Las coordenadas van juntas o no van: una sola no ubica nada. */
export function formatLatLng(
  lat?: string | number | null,
  lng?: string | number | null,
): string {
  const a = toNumero(lat);
  const b = toNumero(lng);
  if (a === null || b === null) return VACIO;
  return `${a}, ${b}`;
}

/** Prisma serializa Decimal como string: hay que convertirlo antes de usarlo. */
export function toNumero(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function tieneCoordenadas(puesto: Pick<Puesto, "lat" | "lng">): boolean {
  return toNumero(puesto.lat) !== null && toNumero(puesto.lng) !== null;
}

// ─── Formato ────────────────────────────────────────────────────────────────

export function formatFecha(iso?: string | null): string {
  if (!iso) return VACIO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return VACIO;
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumero(n?: number | null): string {
  return (n ?? 0).toLocaleString("es-UY");
}

// ─── Badges ─────────────────────────────────────────────────────────────────

/**
 * Color del badge de zona. Las zonas operativas traen su propio color en hex
 * desde la base (`zona_operativa.color`); esta paleta es el fallback estable
 * para las que no lo tengan, derivada del nombre para que una misma zona
 * conserve el color entre renders y entre filas.
 */
const PALETA_ZONA = [
  "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
  "text-orange-300 bg-orange-500/10 border-orange-500/20",
  "text-violet-300 bg-violet-500/10 border-violet-500/20",
  "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  "text-pink-300 bg-pink-500/10 border-pink-500/20",
  "text-amber-300 bg-amber-500/10 border-amber-500/20",
] as const;

export function claseZona(nombre?: string | null): string {
  if (!nombre) return "text-muted-foreground bg-muted/40 border-border";
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  }
  return PALETA_ZONA[hash % PALETA_ZONA.length];
}

// ─── Filtros ────────────────────────────────────────────────────────────────

export const FILTROS_VACIOS = {
  search: "",
  estado: "todos",
  departamentoId: "todos",
  conZona: "todos",
  conMoviles: "todos",
} as const;

export type FiltrosPuestos = {
  search: string;
  estado: string;
  departamentoId: string;
  conZona: string;
  conMoviles: string;
};

// ─── Formulario ─────────────────────────────────────────────────────────────

const numeroOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

export const puestoFormSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "El id es obligatorio")
      .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, "El id debe ser un entero positivo"),
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(40, "Máximo 40 caracteres"),
    departamentoId: z.string().trim().min(1, "El departamento es obligatorio"),
    direccion: z.string().trim().max(100, "Máximo 100 caracteres").optional(),
    zonaId: z.string().trim().optional(),
    mail: z
      .string()
      .trim()
      .max(100)
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "El email no tiene un formato válido"),
    telefono: z.string().trim().max(20, "Máximo 20 caracteres").optional(),
    propio: z.boolean(),
    autopedido: z.boolean(),
    fleteCobra: z.boolean(),
    fleteCantidad: z.string().trim().max(2, "Máximo 2 caracteres").optional(),
    horarios: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
    lat: z.string().trim().optional(),
    lng: z.string().trim().optional(),
    estado: z.enum(["A", "P"]),
  })
  // Lat y lng son todo o nada, igual que valida el backend.
  .refine(
    (d) => (!d.lat && !d.lng) || (!!d.lat && !!d.lng),
    { message: "Latitud y longitud van juntas: cargá las dos o ninguna.", path: ["lat"] },
  )
  .refine((d) => !d.lat || Math.abs(Number(d.lat)) <= 90, {
    message: "La latitud debe estar entre -90 y 90",
    path: ["lat"],
  })
  .refine((d) => !d.lng || Math.abs(Number(d.lng)) <= 180, {
    message: "La longitud debe estar entre -180 y 180",
    path: ["lng"],
  });

export type PuestoFormValues = z.input<typeof puestoFormSchema>;

export { numeroOpcional };
