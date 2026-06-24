import { z } from "zod";

// ─── Estado (CHAR(1) del AS400) ──────────────────────────────────────────────
// A=Activo, I=Inactivo, P=Pendiente, R=Revisión.

const ESTADO_META: Record<
  string,
  { label: string; variant: "success" | "secondary" | "warn" | "destructive" }
> = {
  A: { label: "Activo", variant: "success" },
  I: { label: "Inactivo", variant: "secondary" },
  P: { label: "Pendiente", variant: "warn" },
  R: { label: "Revisión", variant: "warn" },
};

export function estadoLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return ESTADO_META[code]?.label ?? code;
}

export function estadoVariant(
  code: string | null | undefined,
): "success" | "secondary" | "warn" | "destructive" {
  if (!code) return "secondary";
  return ESTADO_META[code]?.variant ?? "secondary";
}

// ─── Interfaces — espejo de Prisma (modelo unificado) ────────────────────────

export interface ClienteTelefono {
  id: number;
  clienteId: number;
  numero: string;
  tipo: string | null;
  estado: string | null;
  alias: string | null;
  principal: boolean;
}

export interface ClienteDireccion {
  id: number;
  clienteId: number;
  calle: string | null;
  nro: string | null;
  esquina1: string | null;
  esquina2: string | null;
  apto: string | null;
  local: string | null;
  departamentoId: number | null;
  localidadId: number | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  geoFuente: string | null;
  calleMatch: boolean | null;
  principal: boolean;
  estado: string | null;
}

// `Cliente` espeja `ClienteUni` (tabla cliente_uni).
export interface Cliente {
  id: number;
  origen: string;
  idOriginal: number;
  nombre: string | null;
  ruc: string | null;
  cedula: string | null;
  email: string | null;
  estado: string | null;
  tipoClienteId: number | null;
  categoriaPrecioId: number | null;
  vip: boolean | null;
  observaciones: string | null;
  observacionesComerc: string | null;
  puntosSaldo: number | null;
  fleteCobra: string | null;
  fleteCantidad: string | null;
  tipoServicioId: number | null;
  gciNro: string | null;
  fechaAlta: string | null;
  ultimaLlamada: string | null;
  dedupGrupo: number | null;
  dedupRevisar: boolean | null;
  // Campos resueltos (opcionales, los completa el backend si los incluye)
  tipoClienteNombre?: string | null;
  categoriaNombre?: string | null;
  // Relaciones
  direcciones: ClienteDireccion[];
  telefonos: ClienteTelefono[];
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedClientes {
  data: Cliente[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

export interface TipoClienteOption {
  id: number;
  descripcion: string | null;
}

export interface CategoriaPrecioOption {
  id: number;
  nombre: string | null;
}

export interface DepartamentoOption {
  id: number;
  nombre: string | null;
}

export interface LocalidadOption {
  id: number;
  nombre: string | null;
  departamentoId: number | null;
}

export interface ZonaOption {
  id: number;
  nombre: string | null;
}

export interface PuestoOption {
  id: number;
  nombre: string | null;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const telefonoSchema = z.object({
  numero: z.string().min(1, "El número es requerido").max(20),
  tipo: z.string().max(2).nullable().optional(),
  estado: z.string().max(1).default("A"),
  alias: z.string().max(60).nullable().optional(),
  principal: z.boolean().default(false),
});

export type TelefonoFormValues = z.infer<typeof telefonoSchema>;

export const direccionSchema = z.object({
  calle: z.string().max(150).nullable().optional(),
  nro: z.string().max(40).nullable().optional(),
  esquina1: z.string().max(150).nullable().optional(),
  esquina2: z.string().max(150).nullable().optional(),
  apto: z.string().max(40).nullable().optional(),
  local: z.string().max(40).nullable().optional(),
  departamentoId: z.number().int().nullable().optional(),
  localidadId: z.number().int().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  direccion: z.string().max(300).nullable().optional(),
  principal: z.boolean().default(false),
  estado: z.string().max(1).default("A"),
});

export type DireccionFormValues = z.infer<typeof direccionSchema>;

/** Schema de la cabecera del cliente (edit/patch). */
export const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(60),
  tipoClienteId: z.number().int().nullable().optional(),
  categoriaPrecioId: z.number().int().nullable().optional(),
  ruc: z.string().max(12).nullable().optional(),
  cedula: z.string().max(12).nullable().optional(),
  email: z
    .string()
    .email("Email inválido")
    .max(60)
    .nullable()
    .optional()
    .or(z.literal("")),
  estado: z.string().max(1).default("A"),
  vip: z.boolean().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  observacionesComerc: z.string().nullable().optional(),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;

const exactamenteUnPrincipal = <T extends { principal: boolean }>(arr: T[]) =>
  arr.filter((x) => x.principal).length === 1;

/** Schema para crear un cliente — arrays anidados con exactamente 1 principal. */
export const createClienteSchema = clienteSchema.extend({
  telefonos: z
    .array(telefonoSchema)
    .min(1, "Se requiere al menos un teléfono")
    .refine(exactamenteUnPrincipal, {
      message: "Debe haber exactamente 1 teléfono principal",
    }),
  direcciones: z
    .array(direccionSchema)
    .min(1, "Se requiere al menos una dirección")
    .refine(exactamenteUnPrincipal, {
      message: "Debe haber exactamente 1 dirección principal",
    }),
});

export type CreateClienteFormValues = z.infer<typeof createClienteSchema>;

/** Query params para listar clientes. */
export interface QueryClientesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  estado?: string;
  origen?: string;
  tipoClienteId?: number;
  dedupRevisar?: boolean;
}
