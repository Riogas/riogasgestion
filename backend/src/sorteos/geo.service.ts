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
        ipPais: resultado.country || undefined,
        ipRegion: resultado.region || undefined,
        ipCiudad: resultado.city || undefined,
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
        gpsPais: address.country || undefined,
        gpsDepartamento: address.state || undefined,
        gpsLocalidad: address.city ?? address.town ?? address.village ?? undefined,
      };
    } catch (error) {
      this.logger.warn(`reverse(${lat}, ${lng}) falló: ${(error as Error).message}`);
      return {};
    }
  }
}
