// Tipos del módulo Zonificación (zonas operativas por puesto).
// Backend real: /api/zonas (NestJS + Postgres goya, espejo con TrackMovil).

export type ZoneType = "DISTRIBUCION" | "FLETE";

export type ServiceType = "URGENTE" | "SERVICE" | "NOCTURNO";

export type ZoneStatus = "ACTIVE" | "ARCHIVED";

/** Estado del espejo con TrackMovil (Supabase). */
export type ZoneSyncStatus = "SYNCED" | "PENDING" | "ERROR" | "NA";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Zone {
  id: number;
  code: string;
  puestoId: number;
  name: string;
  description?: string | null;
  color: string;
  zoneType: ZoneType;
  services: ServiceType[];
  status: ZoneStatus;
  polygon: LatLng[];
  trackZonaId?: number | null;
  syncEstado?: ZoneSyncStatus;
  syncError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Puesto {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
  /** escenario de TrackMovil mapeado (null = las zonas viven solo en goya). */
  escenarioId?: number | null;
}

export interface ZoneFiltersState {
  puestoId: number;
  zoneType: ZoneType | "";
  service: ServiceType | "";
  search: string;
}

export interface ZonePayload {
  puestoId: number;
  name: string;
  description?: string;
  color: string;
  zoneType: ZoneType;
  services: ServiceType[];
  status: ZoneStatus;
  polygon: LatLng[];
}

// ─── Etiquetas / presentación ─────────────────────────────────────────────────

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  DISTRIBUCION: "Distribución",
  FLETE: "Flete",
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  URGENTE: "Urgente",
  SERVICE: "Service",
  NOCTURNO: "Nocturno",
};

export const ALL_SERVICES: ServiceType[] = ["URGENTE", "SERVICE", "NOCTURNO"];

// Paleta de colores disponibles para zonas (círculos del editor).
export const ZONE_COLORS = [
  "#8B5CF6", // violeta
  "#3B82F6", // azul
  "#22D3EE", // cian
  "#22C55E", // verde
  "#EAB308", // amarillo
  "#FB923C", // naranja
  "#EC4899", // rosa
  "#64748B", // gris
] as const;

/** Centro de Uruguay: fallback de mapa cuando el puesto no tiene coordenadas. */
export const URUGUAY_CENTER: LatLng = { lat: -32.8, lng: -56.0 };
