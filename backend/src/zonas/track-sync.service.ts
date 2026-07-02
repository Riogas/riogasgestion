import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

/**
 * Cliente HTTP hacia TrackMovil para el espejo de zonas.
 *
 * Escritura vía la API de import de track (`/api/import/zonas`, header
 * x-api-key = INTERNAL_API_KEY de track, upsert por zona_id en Supabase).
 * Lectura vía `GET /api/zonas` (pull inicial y asignación de zona_id).
 *
 * Si TRACK_API_URL / TRACK_API_KEY no están configuradas, el sync queda
 * deshabilitado y las zonas quedan en syncEstado PENDING.
 */

export interface TrackZona {
  zona_id: number;
  escenario_id: number | null;
  nombre: string | null;
  descripcion: string | null;
  color: string | null;
  activa: boolean | null;
  demora_minutos?: number | null;
  geojson: string | null; // JSON string: [{lat: "…", lng: "…"}]
  created_at?: string;
  updated_at?: string;
}

export interface TrackZonaUpsert {
  zona_id: number;
  escenario_id: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  activa: boolean;
  geojson: string;
  // demora_minutos NO se manda: track conserva el valor propio.
}

const TIMEOUT_MS = 8000;

// track.glp.riogas.com.uy usa certificado autofirmado (CN=node-server.glp.ri):
// mismo patrón que el proxy del frontend (src/app/api/[...path]/route.ts).
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

interface HttpResult {
  status: number;
  body: string;
}

function httpRequest(
  url: string,
  options: { method: string; headers?: Record<string, string>; body?: string },
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const headers = { ...(options.headers ?? {}) };
    if (options.body) {
      // Content-Length explícito: sin esto Node manda chunked y nginx
      // descarta el body de los DELETE (track recibía JSON vacío).
      headers['Content-Length'] = String(Buffer.byteLength(options.body));
    }
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers,
        timeout: TIMEOUT_MS,
        ...(isHttps ? { agent: insecureAgent } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error(`timeout ${TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

@Injectable()
export class TrackSyncService {
  private readonly logger = new Logger(TrackSyncService.name);

  private get baseUrl(): string | null {
    const url = process.env.TRACK_API_URL;
    return url ? url.replace(/\/$/, '') : null;
  }

  private get apiKey(): string | null {
    return process.env.TRACK_API_KEY ?? null;
  }

  get enabled(): boolean {
    return !!this.baseUrl && !!this.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey ?? '',
    };
  }

  async getZonas(): Promise<TrackZona[]> {
    const res = await httpRequest(`${this.baseUrl}/api/zonas`, {
      method: 'GET',
    });
    if (res.status !== 200) {
      throw new Error(`track GET /api/zonas → ${res.status}`);
    }
    const json = JSON.parse(res.body) as { data?: TrackZona[] };
    return json.data ?? [];
  }

  /** Próximo zona_id libre en track (goya es el único escritor). */
  async nextZonaId(): Promise<number> {
    const zonas = await this.getZonas();
    const max = zonas.reduce((m, z) => Math.max(m, z.zona_id ?? 0), 0);
    return max + 1;
  }

  async upsertZona(zona: TrackZonaUpsert): Promise<void> {
    const res = await httpRequest(`${this.baseUrl}/api/import/zonas`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ zonas: [zona] }),
    });
    if (res.status !== 200) {
      throw new Error(
        `track PUT /api/import/zonas → ${res.status} ${res.body.slice(0, 150)}`,
      );
    }
    this.logger.log(`Zona ${zona.zona_id} espejada en track (${zona.nombre})`);
  }

  async deleteZona(zonaId: number): Promise<void> {
    const res = await httpRequest(`${this.baseUrl}/api/import/zonas`, {
      method: 'DELETE',
      headers: this.headers(),
      body: JSON.stringify({ zona_ids: [zonaId] }),
    });
    if (res.status !== 200) {
      throw new Error(
        `track DELETE /api/import/zonas → ${res.status} ${res.body.slice(0, 150)}`,
      );
    }
    this.logger.log(`Zona ${zonaId} eliminada en track`);
  }
}
