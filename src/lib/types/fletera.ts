// Tipos del módulo de empresas fleteras + helper de badge de estado
// (spec 2026-06-25-front-empresas-fleteras-design.md).

export type BadgeVariant =
  | "success"
  | "secondary"
  | "warn"
  | "destructive"
  | "info"
  | "default"
  | "outline";

// ─── Items de lista / detalle ────────────────────────────────────────────────

export interface FleteraListItem {
  id: number;
  idOriginal: number;
  puestoId: number | null;
  puestoNombre: string | null;
  nombre: string | null;
  telefono: string | null;
  calle: string | null;
  estado: string | null;
  cantMoviles: number;
  activos: number;
  ultimaFecha: string | null;
  origen: string;
}

export interface FleteraMovil {
  id: number;
  numero: number | null;
  conductor: string | null;
  activo: boolean;
}

export interface FleteraDetalle {
  id: number;
  origen: string;
  idOriginal: number;
  puestoId: number | null;
  puestoNombre: string | null;
  nombre: string | null;
  nombreComercial: string | null;
  razonSocial: string | null;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  calle: string | null;
  baseOperativa: string | null;
  estado: string | null;
  observaciones: string | null;
  ultimaFecha: string | null;
  movilesActivos: number;
  movilesNoActivos: number;
  moviles: FleteraMovil[];
  zonas: string[];
  pedidosPendientes: number | null;
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export interface FleteraKpis {
  total: number;
  activas: number;
  movilesAsociados: number;
  puestosCubiertos: number;
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface FleteraFiltros {
  estados: { value: string; label: string }[];
  puestos: { id: number; nombre: string | null }[];
}

// ─── Paginación ──────────────────────────────────────────────────────────────

export interface PaginatedFleteras {
  data: FleteraListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryFleterasParams {
  page?: number;
  pageSize?: number;
  search?: string;
  estado?: string;
  puestoId?: number;
  conMoviles?: string;
}

// ─── Badge helper ──────────────────────────────────────────────────────────────

// Estado: A=Activo→verde / P=Pasivo→gris / I=Inactivo→rojo.
export function estadoFleteraBadge(estado: string | null | undefined): {
  label: string;
  variant: BadgeVariant;
} {
  switch (estado) {
    case "A":
      return { label: "Activo", variant: "success" };
    case "P":
      return { label: "Pasivo", variant: "secondary" };
    case "I":
      return { label: "Inactivo", variant: "destructive" };
    default:
      return { label: "—", variant: "secondary" };
  }
}
