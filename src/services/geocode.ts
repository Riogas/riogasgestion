// Geocodificación contra el Nominatim propio (https://nominatim.riogas.uy).

const NOMINATIM_URL = (
  process.env.NEXT_PUBLIC_NOMINATIM_URL || "https://nominatim.riogas.uy"
).replace(/\/$/, "");

export interface GeocodeResult {
  lat: number;
  lng: number;
  display: string;
  calle?: string;
  localidad?: string;
  departamento?: string;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  town?: string;
  city?: string;
  village?: string;
  state?: string;
  county?: string;
}

function parseAddress(addr: NominatimAddress | undefined) {
  return {
    calle: addr?.road ?? addr?.pedestrian ?? undefined,
    localidad: addr?.town ?? addr?.city ?? addr?.village ?? undefined,
    departamento: addr?.state ?? addr?.county ?? undefined,
  };
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = `${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(
      q,
    )}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: NominatimAddress;
    }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const { calle, localidad, departamento } = parseAddress(first.address);
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      display: first.display_name,
      calle,
      localidad,
      departamento,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  try {
    const url = `${NOMINATIM_URL}/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat?: string;
      lon?: string;
      display_name?: string;
      address?: NominatimAddress;
    };
    if (!data || !data.display_name) return null;
    const { calle, localidad, departamento } = parseAddress(data.address);
    return {
      lat,
      lng,
      display: data.display_name,
      calle,
      localidad,
      departamento,
    };
  } catch {
    return null;
  }
}
