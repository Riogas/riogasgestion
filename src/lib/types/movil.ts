// Tipos del módulo de móviles + helpers de badge (colores del spec
// 2026-06-25-front-moviles-admin-design.md).

export type BadgeVariant =
  | "success"
  | "secondary"
  | "warn"
  | "destructive"
  | "info"
  | "default"
  | "outline";

// ─── Items de lista / detalle ────────────────────────────────────────────────

export interface MovilListItem {
  id: number;
  numero: number | null;
  matricula: string | null;
  fleteraNombre: string | null;
  estadoCodigo: number | null;
  estadoNombre: string | null;
  tipoServicio: string | null;
  pedidosPendientes: number | null;
  capacidadLote: number | null;
  ok: "S" | "N";
  tieneGps: boolean | null;
  observaciones: string | null;
  ultimaActualizacion: string | null;
  origen: string;
}

export interface MovilDetalle {
  id: number;
  origen: string;
  idOriginal: number;
  numero: number | null;
  matricula: string | null;
  descripcion: string | null;
  marca: string | null;
  modelo: string | null;
  fleteraId: number | null;
  fleteraNombre: string | null;
  estadoCodigo: number | null;
  estadoNombre: string | null;
  tipoServicio: string | null;
  servicioPrincipal: string | null;
  servicioNombre: string | null;
  pedidosPendientes: number | null;
  capacidadLote: number | null;
  ok: "S" | "N";
  rutea: boolean | null;
  tieneGps: boolean | null;
  gpsReportando: boolean | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
  destinoId: number | null;
  destinoNombre: string | null;
  observaciones: string | null;
  ultimaActualizacion: string | null;
  historico: MovilHistoricoItem[];
}

export interface MovilHistoricoItem {
  id: number;
  fecha: string | null;
  accion: string | null;
  usuario: string | null;
  detalle: string | null;
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export interface MovilKpis {
  total: number;
  activosEnViaje: number;
  enEspera: number;
  sinGps: number;
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface MovilFiltros {
  estados: { codigo: number; nombre: string }[];
  servicios: string[];
  fleteras: { id: number; nombre: string | null }[];
}

// ─── Paginación ──────────────────────────────────────────────────────────────

export interface PaginatedMoviles {
  data: MovilListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryMovilesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  estadoCodigo?: number;
  tipoServicio?: string;
  fleteraId?: number;
  rutaIca?: string;
  origen?: string;
  sort?: string;
}

// ─── Badge helpers ───────────────────────────────────────────────────────────

// Estado: nombre contiene "VIAJE"→verde; "ESPERA"+"RECARGA"→cyan;
// "ESPERA"→naranja; "INACTIVO"/"NO ACTIVO"/"NO TRABAJA"→rojo; default gris.
export function estadoBadge(nombre: string | null | undefined): {
  label: string;
  variant: BadgeVariant;
} {
  if (!nombre) return { label: "—", variant: "secondary" };
  const n = nombre.toUpperCase();
  if (n.includes("VIAJE")) return { label: nombre, variant: "success" };
  if (n.includes("ESPERA") && n.includes("RECARGA"))
    return { label: nombre, variant: "info" };
  if (n.includes("ESPERA")) return { label: nombre, variant: "warn" };
  if (n.includes("INACTIVO") || n.includes("NO ACTIVO") || n.includes("NO TRABAJA"))
    return { label: nombre, variant: "destructive" };
  return { label: nombre, variant: "secondary" };
}

// Servicio: "URG"→violeta (usamos info como acento alternativo del theme);
// "SERVI"→azul (default/primary); otro→gris.
export function servicioBadge(servicio: string | null | undefined): {
  label: string;
  variant: BadgeVariant;
  className?: string;
} {
  if (!servicio) return { label: "—", variant: "secondary" };
  const s = servicio.toUpperCase();
  if (s.includes("URG"))
    return {
      label: servicio,
      variant: "outline",
      className: "border-violet-500/40 bg-violet-500/10 text-violet-400",
    };
  if (s.includes("SERVI")) return { label: servicio, variant: "default" };
  return { label: servicio, variant: "secondary" };
}

// GPS: true→verde / false-null→rojo
export function gpsBadge(tieneGps: boolean | null | undefined): {
  label: string;
  variant: BadgeVariant;
} {
  return tieneGps
    ? { label: "Con GPS", variant: "success" }
    : { label: "Sin GPS", variant: "destructive" };
}
