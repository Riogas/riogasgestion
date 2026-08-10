// Tipos de Puestos — espejo de `backend/src/puestos/`.
// Los flags del legado ('S'/'N') y el estado ('A'/'P') viajan como texto:
// no los convertimos a boolean en el transporte para no perder el "no cargado"
// (null), que la UI muestra como "—".

/** Estado del puesto en la base: A=Activo, P=Pasivo. */
export type PuestoEstado = "A" | "P";

/** Flag legacy de un caracter. */
export type FlagSN = "S" | "N";

export interface Puesto {
  id: number;
  nombre: string | null;
  direccion: string | null;
  departamentoId: number | null;
  localidadId: number | null;
  zonaId: number | null;
  fleteCobra: string | null;
  fleteCantidad: string | null;
  autopedido: string | null;
  horarios: string | null;
  mail: string | null;
  telefono: string | null;
  propio: string | null;
  lat: string | number | null;
  lng: string | number | null;
  estado: string | null;
  updatedAt: string | null;

  // Derivados que agrega el backend cruzando las tablas relacionadas.
  departamentoNombre: string | null;
  localidadNombre: string | null;
  zonaNombre: string | null;
  /** Cantidad de zonas operativas ACTIVE del puesto. */
  zonasOperativas: number;
  /** Cantidad de móviles con `movil.puestoId = puesto.id`. */
  moviles: number;
}

export interface ZonaOperativaDePuesto {
  id: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  tipoZona: string;
  servicios: string[];
  estado: string;
  updatedAt: string | null;
}

export interface MovilDePuesto {
  id: number;
  numeroMovil: number | null;
  descripcion: string | null;
  matricula: string | null;
  estadoCodigo: number | null;
  ultimaPosicionAt: string | null;
  tieneGps: boolean | null;
}

export interface PuestoDetalle extends Puesto {
  zonas: ZonaOperativaDePuesto[];
  movilesLista: MovilDePuesto[];
}

export interface PuestoKpis {
  total: number;
  activos: number;
  conZona: number;
  conMoviles: number;
  pctActivos: number;
  pctConZona: number;
  pctConMoviles: number;
}

export interface DepartamentoOpcion {
  id: number;
  nombre: string | null;
  /** true si algún puesto lo tiene asignado. */
  enUso: boolean;
}

export interface PuestosFiltrosData {
  departamentos: DepartamentoOpcion[];
}

export interface QueryPuestosParams {
  page?: number;
  pageSize?: number;
  search?: string;
  estado?: string;
  departamentoId?: number;
  conZona?: "con" | "sin";
  conMoviles?: "con" | "sin";
}

export interface PaginatedPuestos {
  items: Puesto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CrearPuestoPayload {
  id: number;
  nombre: string;
  departamentoId: number;
  direccion?: string;
  localidadId?: number;
  zonaId?: number;
  mail?: string;
  telefono?: string;
  propio?: FlagSN;
  autopedido?: FlagSN;
  fleteCobra?: FlagSN;
  fleteCantidad?: string;
  horarios?: string;
  lat?: number;
  lng?: number;
  estado?: PuestoEstado;
}

export type ActualizarPuestoPayload = Partial<Omit<CrearPuestoPayload, "id">>;
