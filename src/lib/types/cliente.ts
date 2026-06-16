import { z } from "zod";

// ─── Enums (mirrors backend/src/clientes/enums.ts) ───────────────────────────

export enum TipoCliente {
  DOMESTICO = "DOMESTICO",
  COMERCIAL = "COMERCIAL",
}

export enum CategoriaCliente {
  RESIDENCIAL = "RESIDENCIAL",
  COMERCIAL = "COMERCIAL",
  INDUSTRIAL = "INDUSTRIAL",
}

export enum EstadoCliente {
  ACTIVO = "ACTIVO",
  INACTIVO = "INACTIVO",
  PENDIENTE = "PENDIENTE",
}

// ─── Plain TypeScript interfaces (mirrors entities) ──────────────────────────

export interface ClienteTelefono {
  id: string;
  numero: string;
  alias: string | null;
  tipo: string | null;
  estado: string;
  esPrincipal: boolean;
}

export interface ClienteDireccion {
  id: string;
  calle: string;
  nroPuerta: string | null;
  esquina1: string | null;
  esquina2: string | null;
  apto: string | null;
  local: string | null;
  departamentoId: number | null;
  localidadId: number | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  nivel: string | null;
  esPrincipal: boolean;
  enZona: boolean | null;
}

export interface Cliente {
  id: string;
  nroCliente: number | null;
  nombre: string;
  apellido: string | null;
  tipoCliente: TipoCliente;
  categoria: CategoriaCliente | null;
  rutCi: string | null;
  gci: string | null;
  email: string | null;
  privilegio: string | null;
  obsCliente: string | null;
  obsGeneral: string | null;
  obsComercial: string | null;
  estado: EstadoCliente;
  fechaAlta: string | null;
  fechaUltModif: string | null;
  fechaUltCompra: string | null;
  telefonos: ClienteTelefono[];
  direcciones: ClienteDireccion[];
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedClientes {
  data: Cliente[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const telefonoSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().min(1, "El número es requerido").max(40),
  alias: z.string().max(60).nullable().optional(),
  tipo: z.string().max(40).nullable().optional(),
  estado: z.string().max(20).default("ACTIVO"),
  esPrincipal: z.boolean().default(false),
});

export type TelefonoFormValues = z.infer<typeof telefonoSchema>;

export const direccionSchema = z.object({
  id: z.string().uuid().optional(),
  calle: z.string().min(1, "La calle es requerida").max(160),
  nroPuerta: z.string().max(20).nullable().optional(),
  esquina1: z.string().max(160).nullable().optional(),
  esquina2: z.string().max(160).nullable().optional(),
  apto: z.string().max(40).nullable().optional(),
  local: z.string().max(60).nullable().optional(),
  departamentoId: z.number().int().nullable().optional(),
  localidadId: z.number().int().nullable().optional(),
  zona: z.string().max(80).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  nivel: z.string().max(40).nullable().optional(),
  esPrincipal: z.boolean().default(false),
  enZona: z.boolean().nullable().optional(),
});

export type DireccionFormValues = z.infer<typeof direccionSchema>;

/** Schema for the main client data form (edit/patch) */
export const clienteSchema = z.object({
  nroCliente: z.number().int().nullable().optional(),
  nombre: z.string().min(1, "El nombre es requerido").max(120),
  apellido: z.string().max(120).nullable().optional(),
  tipoCliente: z.nativeEnum(TipoCliente).default(TipoCliente.DOMESTICO),
  categoria: z.nativeEnum(CategoriaCliente).nullable().optional(),
  rutCi: z.string().max(32).nullable().optional(),
  gci: z.string().max(32).nullable().optional(),
  email: z.string().email("Email inválido").max(160).nullable().optional().or(z.literal("")),
  privilegio: z.string().max(60).nullable().optional(),
  obsCliente: z.string().nullable().optional(),
  obsGeneral: z.string().nullable().optional(),
  obsComercial: z.string().nullable().optional(),
  estado: z.nativeEnum(EstadoCliente).default(EstadoCliente.ACTIVO),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;

/** Schema for creating a new client — nombre required, at least one phone and one address */
export const createClienteSchema = clienteSchema.extend({
  nombre: z.string().min(1, "El nombre es requerido").max(120),
  telefonos: z
    .array(telefonoSchema)
    .min(1, "Se requiere al menos un teléfono"),
  direcciones: z
    .array(direccionSchema)
    .min(1, "Se requiere al menos una dirección"),
});

export type CreateClienteFormValues = z.infer<typeof createClienteSchema>;

/** Query params for listing clients */
export interface QueryClientesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  estado?: EstadoCliente;
  tipoCliente?: TipoCliente;
}
