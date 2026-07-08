import type { Cliente, ClienteTelefono, ClienteDireccion } from "./cliente";

// ─── Interfaces — espejo de Prisma (capa de identidad) ───────────────────────

export interface Persona {
  id: number;
  nombreOficial: string | null;
  cedula: string | null;
  rucPrincipal: string | null;
  telefonoPrincipalId: number | null;
  direccionPrincipalId: number | null;
  estado: string | null;
  notasInternas: string | null;
}

export interface Hogar {
  id: number;
  etiqueta: string | null;
  direccionTextoNorm: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Persona360 {
  persona: Persona;
  registros: Cliente[];
  telefonos: ClienteTelefono[];
  direcciones: ClienteDireccion[];
  hogares: Hogar[];
}

export interface MatchSugerencia {
  id: number;
  tipo: "DUPLICADO" | "HOGAR";
  registroA: number | null;
  registroB: number | null;
  personaA: number | null;
  personaB: number | null;
  senal: string;
  confianza: number;
  estado: "PENDIENTE" | "ACEPTADO" | "RECHAZADO";
  operador: string | null;
  resueltoAt: string | null;
  hogarIdResuelto: number | null;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedSugerencias {
  data: MatchSugerencia[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query params para listar sugerencias del workbench. */
export interface QuerySugerenciasParams {
  tipo?: string;
  estado?: string;
  minConfianza?: number;
  page?: number;
  pageSize?: number;
}

// ─── Identificación del distribuidor ─────────────────────────────────────────

export interface FichaRedactada {
  nombre: string;
  estado?: string;
  cedula?: string;
  telefono?: ClienteTelefono;
  direccion?: ClienteDireccion;
  scope: "MINIMA" | "AFILIADA" | "COMPLETA";
}

export interface IdentificarParams {
  identificador: string;
  tipo: "CEDULA" | "TELEFONO";
}

export interface IdentificarResultado {
  resultado: "MATCH" | "SIN_MATCH";
  ficha?: FichaRedactada;
  requiereAltaDireccion?: boolean;
}

// ─── Datos canónicos ─────────────────────────────────────────────────────────

export interface SetCanonicalParams {
  nombreOficial?: string;
  cedula?: string;
  telefonoPrincipalId?: number;
  direccionPrincipalId?: number;
}
