// Tipos del módulo Sorteos (admin) — espejo 1:1 de `backend/src/sorteos/sorteos.service.ts`
// y del modelo Prisma (`backend/prisma/schema.prisma`, models Sorteo*).

// ─── Estado ───────────────────────────────────────────────────────────────

export const ESTADOS_SORTEO = ["borrador", "activo", "finalizado", "cancelado"] as const;

export type EstadoSorteo = (typeof ESTADOS_SORTEO)[number];

export type BadgeVariant =
  | "success"
  | "secondary"
  | "warn"
  | "destructive"
  | "info"
  | "default"
  | "outline";

const ESTADO_BADGE: Record<EstadoSorteo, { label: string; variant: BadgeVariant }> = {
  borrador: { label: "Borrador", variant: "secondary" },
  activo: { label: "Activo", variant: "success" },
  finalizado: { label: "Finalizado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export function estadoSorteoBadge(estado: EstadoSorteo | string): {
  label: string;
  variant: BadgeVariant;
} {
  return ESTADO_BADGE[estado as EstadoSorteo] ?? { label: estado, variant: "secondary" };
}

export function esEstadoSorteo(value: string): value is EstadoSorteo {
  return (ESTADOS_SORTEO as readonly string[]).includes(value);
}

// ─── Sorteo ───────────────────────────────────────────────────────────────

/** Fila base de la tabla `sorteo` (respuesta de crear/actualizar/activar/finalizar/cancelar). */
export interface Sorteo {
  id: number;
  nombre: string;
  descripcion: string | null;
  premioDescripcion: string;
  fechaDesde: string;
  fechaHasta: string;
  cantidadPremios: number;
  maxRegistrosDispositivoDia: number;
  edadMinima: number;
  estado: EstadoSorteo;
  createdAt: string;
  updatedAt: string;
}

/** Fila del listado — `SorteosService.listar()` agrega contadores por sorteo. */
export interface SorteoListItem extends Sorteo {
  _count: {
    participaciones: number;
    codigos: number;
    ganadores: number;
  };
  premiosEntregados: number;
}

export interface SorteoStatsPorDia {
  fecha: string;
  cantidad: number;
  ganadores: number;
}

export interface SorteoStatsPorDepartamento {
  departamento: string;
  cantidad: number;
}

export interface SorteoStats {
  participaciones: number;
  ganadores: number;
  premiosEntregados: number;
  codigosTotal: number;
  codigosUsados: number;
  porDia: SorteoStatsPorDia[];
  porDepartamento: SorteoStatsPorDepartamento[];
}

/** `SorteosService.detalle()`: fila base + estadísticas agregadas. */
export interface SorteoDetalle extends Sorteo {
  stats: SorteoStats;
}

export interface PaginatedSorteos {
  items: SorteoListItem[];
  total: number;
}

// ─── Payloads (crear / actualizar) ─────────────────────────────────────────

export interface CrearSorteoPayload {
  nombre: string;
  descripcion?: string;
  premioDescripcion: string;
  /** ISO 8601 — el backend lo parsea con `@Type(() => Date)`. */
  fechaDesde: string;
  fechaHasta: string;
  cantidadPremios: number;
  maxRegistrosDispositivoDia?: number;
  edadMinima?: number;
}

export type ActualizarSorteoPayload = Partial<CrearSorteoPayload>;

// ─── Query params ───────────────────────────────────────────────────────────

export interface QuerySorteosParams {
  page?: number;
  pageSize?: number;
  search?: string;
  estado?: EstadoSorteo;
}

export interface QuerySorteoParticipacionesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  soloGanadores?: boolean;
}

// ─── Lotes de códigos ───────────────────────────────────────────────────────

/** Fila de `SorteosService.listarLotes()`. */
export interface SorteoLote {
  id: number;
  sorteoId: number;
  cantidad: number;
  generadoPor: string | null;
  createdAt: string;
  codigosTotal: number;
  codigosUsados: number;
}

/** Respuesta de `POST /sorteos/:id/lotes` (`SorteosService.crearLote()`). */
export interface SorteoLoteCreado {
  id: number;
  cantidad: number;
}

// ─── Participaciones ────────────────────────────────────────────────────────

/** Fila de la tabla `sorteo_participacion` + código canjeado (include del service). */
export interface SorteoParticipacion {
  id: number;
  sorteoId: number;
  codigoId: number;
  nombre: string;
  telefono: string;
  edad: number;
  email: string | null;
  ganador: boolean;
  codigoCanje: string | null;
  premioEntregado: boolean;
  premioEntregadoAt: string | null;
  deviceId: string;
  fingerprint: string | null;
  userAgent: string | null;
  ip: string | null;
  idioma: string | null;
  plataforma: string | null;
  resolucion: string | null;
  ipPais: string | null;
  ipRegion: string | null;
  ipCiudad: string | null;
  gpsLat: string | null;
  gpsLng: string | null;
  gpsPais: string | null;
  gpsDepartamento: string | null;
  gpsLocalidad: string | null;
  geoFuente: string | null;
  createdAt: string;
  /**
   * Solo viene en `GET /sorteos/:id/participaciones` (el service hace
   * `include: { codigo: { select: { codigo: true } } }`). `marcarPremioEntregado`
   * responde el `update()` crudo de Prisma, sin ese include, así que el objeto que
   * devuelve `POST /sorteos/participaciones/:id/entregar` NO trae este campo.
   */
  codigo?: { codigo: string };
}

/** Participación ganadora — mismo shape, filtradas con `soloGanadores=true`. */
export type SorteoGanador = SorteoParticipacion;

export interface PaginatedParticipaciones {
  items: SorteoParticipacion[];
  total: number;
}
