// Servicio mock de Zonificación — store en memoria con API async.
// Cuando exista backend, reemplazar el cuerpo de estas funciones por
// llamadas axios (mismo patrón que src/services/moviles.ts) sin tocar la UI.

import type {
  Puesto,
  ServiceType,
  Zone,
  ZonePayload,
} from "@/lib/types/zona";

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

// ─── Puestos mock ─────────────────────────────────────────────────────────────

const PUESTOS: Puesto[] = [
  { id: "salto", name: "SALTO", lat: -31.3883, lng: -57.9606 },
  { id: "montevideo", name: "MONTEVIDEO", lat: -34.9011, lng: -56.1645 },
  { id: "paysandu", name: "PAYSANDÚ", lat: -32.3214, lng: -58.0756 },
  { id: "maldonado", name: "MALDONADO", lat: -34.9088, lng: -54.9581 },
  { id: "tacuarembo", name: "TACUAREMBÓ", lat: -31.7333, lng: -55.9833 },
];

// ─── Zonas mock (Salto) ───────────────────────────────────────────────────────

const svc = (...s: ServiceType[]) => s;

let seq = 7; // próximas altas: Z-007 en adelante

let ZONES: Zone[] = [
  {
    id: "z-1",
    code: "ZN-001",
    puestoId: "salto",
    name: "Zona Norte",
    description: "Zona residencial del norte de la ciudad.",
    color: "#8B5CF6",
    zoneType: "DISTRIBUCION",
    services: svc("URGENTE", "SERVICE", "NOCTURNO"),
    status: "ACTIVE",
    polygon: [
      { lat: -31.355, lng: -57.99 },
      { lat: -31.352, lng: -57.955 },
      { lat: -31.358, lng: -57.938 },
      { lat: -31.378, lng: -57.94 },
      { lat: -31.378, lng: -57.985 },
    ],
  },
  {
    id: "z-2",
    code: "ZC-002",
    puestoId: "salto",
    name: "Zona Centro",
    description: "Casco urbano y microcentro comercial.",
    color: "#22D3EE",
    zoneType: "DISTRIBUCION",
    services: svc("URGENTE", "SERVICE", "NOCTURNO"),
    status: "ACTIVE",
    polygon: [
      { lat: -31.378, lng: -57.985 },
      { lat: -31.378, lng: -57.94 },
      { lat: -31.398, lng: -57.942 },
      { lat: -31.398, lng: -57.982 },
    ],
  },
  {
    id: "z-3",
    code: "ZE-003",
    puestoId: "salto",
    name: "Zona Este",
    description: "Barrios del este, hasta la ruta de circunvalación.",
    color: "#FB923C",
    zoneType: "DISTRIBUCION",
    services: svc("URGENTE", "SERVICE", "NOCTURNO"),
    status: "ACTIVE",
    polygon: [
      { lat: -31.358, lng: -57.938 },
      { lat: -31.36, lng: -57.9 },
      { lat: -31.4, lng: -57.898 },
      { lat: -31.398, lng: -57.942 },
      { lat: -31.378, lng: -57.94 },
    ],
  },
  {
    id: "z-4",
    code: "ZO-004",
    puestoId: "salto",
    name: "Zona Oeste",
    description: "Franja costera sobre el río Uruguay.",
    color: "#22C55E",
    zoneType: "FLETE",
    services: svc("SERVICE"),
    status: "ACTIVE",
    polygon: [
      { lat: -31.378, lng: -58.01 },
      { lat: -31.378, lng: -57.985 },
      { lat: -31.398, lng: -57.982 },
      { lat: -31.408, lng: -58.005 },
    ],
  },
  {
    id: "z-5",
    code: "ZS-005",
    puestoId: "salto",
    name: "Zona Sur",
    description: "Barrios del sur y acceso a la represa.",
    color: "#EC4899",
    zoneType: "DISTRIBUCION",
    services: svc("URGENTE", "SERVICE"),
    status: "ACTIVE",
    polygon: [
      { lat: -31.398, lng: -57.982 },
      { lat: -31.398, lng: -57.942 },
      { lat: -31.425, lng: -57.94 },
      { lat: -31.43, lng: -57.985 },
      { lat: -31.408, lng: -58.005 },
    ],
  },
  {
    id: "z-6",
    code: "ZI-006",
    puestoId: "salto",
    name: "Zona Industrial",
    description: "Parque industrial y depósitos del sureste.",
    color: "#EAB308",
    zoneType: "FLETE",
    services: svc("URGENTE", "NOCTURNO"),
    status: "ACTIVE",
    polygon: [
      { lat: -31.4, lng: -57.898 },
      { lat: -31.402, lng: -57.862 },
      { lat: -31.432, lng: -57.858 },
      { lat: -31.425, lng: -57.94 },
      { lat: -31.398, lng: -57.942 },
    ],
  },
];

// ─── API mock ─────────────────────────────────────────────────────────────────

export async function getPuestos(): Promise<Puesto[]> {
  await delay(100);
  return [...PUESTOS];
}

export async function getZones(puestoId: string): Promise<Zone[]> {
  await delay();
  return ZONES.filter((z) => z.puestoId === puestoId).map((z) => ({ ...z }));
}

function makeCode(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, "Z");
  return `${initials}-${String(seq).padStart(3, "0")}`;
}

export async function createZone(payload: ZonePayload): Promise<Zone> {
  await delay();
  const zone: Zone = {
    ...payload,
    id: `z-${seq}`,
    code: makeCode(payload.name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  seq += 1;
  ZONES = [...ZONES, zone];
  return { ...zone };
}

export async function updateZone(
  id: string,
  patch: Partial<ZonePayload>,
): Promise<Zone> {
  await delay();
  const idx = ZONES.findIndex((z) => z.id === id);
  if (idx === -1) throw new Error(`Zona ${id} no encontrada`);
  const updated: Zone = {
    ...ZONES[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  ZONES = ZONES.map((z) => (z.id === id ? updated : z));
  return { ...updated };
}

export async function deleteZone(id: string): Promise<void> {
  await delay();
  ZONES = ZONES.filter((z) => z.id !== id);
}

export async function duplicateZone(id: string): Promise<Zone> {
  await delay();
  const src = ZONES.find((z) => z.id === id);
  if (!src) throw new Error(`Zona ${id} no encontrada`);
  // Offset leve para que el duplicado no quede exactamente encima.
  const polygon = src.polygon.map((p) => ({
    lat: p.lat + 0.006,
    lng: p.lng + 0.006,
  }));
  return createZone({
    puestoId: src.puestoId,
    name: `${src.name} (copia)`,
    description: src.description,
    color: src.color,
    zoneType: src.zoneType,
    services: [...src.services],
    status: "ACTIVE",
    polygon,
  });
}
