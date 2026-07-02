// Tipos del módulo Zonificación (zonas operativas por puesto).

export type ZoneType = "DISTRIBUCION" | "FLETE";

export type ServiceType = "URGENTE" | "SERVICE" | "NOCTURNO";

export type ZoneStatus = "ACTIVE" | "ARCHIVED";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  code: string;
  puestoId: string;
  name: string;
  description?: string;
  color: string;
  zoneType: ZoneType;
  services: ServiceType[];
  status: ZoneStatus;
  polygon: LatLng[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Puesto {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface ZoneFiltersState {
  puestoId: string;
  zoneType: ZoneType | "";
  service: ServiceType | "";
  search: string;
}

export type ZonePayload = Omit<Zone, "id" | "code" | "createdAt" | "updatedAt">;

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
