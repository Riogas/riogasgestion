import { Injectable, Logger } from '@nestjs/common';
import * as geoip from 'geoip-lite';

export interface GeoPorIp {
  ipPais?: string;
  ipRegion?: string;
  ipCiudad?: string;
}

export interface GeoReverse {
  gpsPais?: string;
  gpsDepartamento?: string;
  gpsLocalidad?: string;
}

interface NominatimAddress {
  country?: string;
  state?: string;
  city?: string;
  town?: string;
  village?: string;
}

interface NominatimReverseResponse {
  address?: NominatimAddress;
}

/**
 * Anchos de las columnas geo de `sorteo_participacion`. Ni Nominatim ni geoip-lite
 * garantizan largo: las coordenadas las manda el cliente, y un nombre más largo
 * que la columna aborta la transacción entera de participar (500 persistente).
 */
const MAX_PAIS = 60;
const MAX_REGION = 60;
const MAX_LOCALIDAD = 80;

function recortar(valor: string | undefined, max: number): string | undefined {
  return valor ? valor.slice(0, max) : undefined;
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  /** Geolocaliza por IP. IPs privadas/vacías/no resueltas → {}. Nunca lanza. */
  porIp(ip?: string): GeoPorIp {
    if (!ip) return {};

    try {
      const resultado = geoip.lookup(ip);
      if (!resultado) return {};

      return {
        ipPais: recortar(resultado.country || undefined, MAX_PAIS),
        ipRegion: recortar(resultado.region || undefined, MAX_REGION),
        ipCiudad: recortar(resultado.city || undefined, MAX_LOCALIDAD),
      };
    } catch (error) {
      this.logger.warn(`porIp(${ip}) falló: ${(error as Error).message}`);
      return {};
    }
  }

  /** Reverse geocoding vía Nominatim. Ante cualquier error → {}. Nunca lanza. */
  async reverse(lat: number, lng: number): Promise<GeoReverse> {
    try {
      const base = process.env.NOMINATIM_URL || 'https://nominatim.riogas.uy';
      const url = `${base}/reverse?lat=${lat}&lon=${lng}&format=jsonv2`;
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return {};

      const data = (await response.json()) as NominatimReverseResponse;
      const address = data.address;
      if (!address) return {};

      return {
        gpsPais: recortar(address.country || undefined, MAX_PAIS),
        gpsDepartamento: recortar(address.state || undefined, MAX_REGION),
        gpsLocalidad: recortar(
          address.city ?? address.town ?? address.village ?? undefined,
          MAX_LOCALIDAD,
        ),
      };
    } catch (error) {
      this.logger.warn(`reverse(${lat}, ${lng}) falló: ${(error as Error).message}`);
      return {};
    }
  }
}
