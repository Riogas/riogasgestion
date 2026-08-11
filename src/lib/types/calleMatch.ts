// Puente nomenclator↔OSM — tipos de la pantalla de revisión.
// Backend real: /api/calles/* (NestJS + Postgres goya, spec 2026-08-11).

export type EstadoMatch =
  | "AUTO_CONFIRMADO"
  | "A_REVISAR"
  | "RECHAZADO"
  | "CONFIRMADO_MANUAL";

export interface DetalleMatch {
  evidencia?: string;
  scoreNombre?: number;
  bonusLocalidad?: number;
  ambiguo?: boolean;
  geo?: {
    coincide?: boolean;
    contradice?: boolean;
    ratio?: number;
    clientes?: number;
  };
  alternativas?: { osmId: number; nombre: string; score: number }[];
  geoSugiere?: { osmId: number; nombre: string; ratio: number };
}

export interface MatchFila {
  id: number;
  estado: EstadoMatch;
  metodo: "EXACTO" | "FUZZY" | "GEOMETRICO" | "MANUAL";
  score: number;
  clientes: number;
  detalle: DetalleMatch | null;
  revisadoPor: string | null;
  nomenclator: {
    calid: number;
    nombre: string | null;
    exNombre: string | null;
    ciudad: string | null;
  } | null;
  osm: {
    id: number;
    nombre: string;
    localidad: string | null;
    departamento: string;
    lat: number;
    lng: number;
  } | null;
}

export interface MapaMatch {
  matchId: number;
  calleOsm: {
    nombre: string;
    puntos: [number, number][];
    lat: number;
    lng: number;
  } | null;
  clientes: [number, number][];
}

export interface CalleSugerida {
  fuente: "osm" | "nomenclator";
  nombre: string;
  departamento: string | null;
  localidad: string | null;
  calid: number | null;
  matchEstado: EstadoMatch | null;
  calleOsmId: number | null;
  clientes: number;
  variantes: string[];
}
