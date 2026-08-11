import { Injectable, Logger } from '@nestjs/common';
import { CallesService } from './calles.service';
import { normalizarCalle } from './normalizar';

/**
 * Esquinas de la cuadra vía el stack OSM propio.
 *
 * Nominatim ubica el punto (portal exacto o eje de calle) y Overpass da las
 * intersecciones REALES: los nodos que la calle comparte con otras calles.
 * Nada de "la calle más cercana", que suele mentir.
 *
 * Cada esquina vuelve con su CALID del nomenclator (resuelto contra el índice)
 * para que el VB6 pueda guardar CALESQ1ID/CALESQ2ID como siempre.
 *
 * Los servicios van por http plano a propósito: el certificado del nginx no
 * cubre los `.riogas.uy` (mismo gotcha que GeoPicker). Esto corre server-side.
 */

const NOMINATIM = process.env.NOMINATIM_URL ?? 'http://nominatim.riogas.uy';
const OVERPASS = process.env.OVERPASS_URL ?? 'http://overpass.riogas.uy';
const TIMEOUT_NOMINATIM = 8_000;
const TIMEOUT_OVERPASS = 5_000;

export interface ResultadoEsquinas {
  encontrada: boolean;
  precision: 'EXACTA' | 'INTERPOLADA' | 'CALLE' | 'SIN_UBICAR';
  lat: number | null;
  lng: number | null;
  calle: string | null;
  calid: number | null;
  esquina1: { nombre: string; calid: number | null } | null;
  esquina2: { nombre: string; calid: number | null } | null;
  barrio: string | null;
  localidad: string | null;
  codigoPostal: string | null;
}

interface NominatimResult {
  lat: string;
  lon: string;
  type: string;
  place_rank: number;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
  };
}

interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

const SIN_UBICAR: ResultadoEsquinas = {
  encontrada: false,
  precision: 'SIN_UBICAR',
  lat: null,
  lng: null,
  calle: null,
  calid: null,
  esquina1: null,
  esquina2: null,
  barrio: null,
  localidad: null,
  codigoPostal: null,
};

async function traerJson(url: string, timeout: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'goya-calles/1.0' },
    });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

@Injectable()
export class EsquinasService {
  private readonly logger = new Logger(EsquinasService.name);
  // Las direcciones repetidas del día salen de acá, no de Nominatim.
  private cache = new Map<string, { valor: ResultadoEsquinas; vence: number }>();

  constructor(private readonly calles: CallesService) {}

  async esquinasDe(
    calle: string,
    numero: string | undefined,
    depto: string | undefined,
    ciudad: string | undefined,
  ): Promise<ResultadoEsquinas> {
    const clave = `${normalizarCalle(calle)}|${numero ?? ''}|${depto ?? ''}|${ciudad ?? ''}`;
    const enCache = this.cache.get(clave);
    if (enCache && enCache.vence > Date.now()) return enCache.valor;

    const valor = await this.resolver(calle, numero, depto, ciudad);
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(clave, { valor, vence: Date.now() + 6 * 3600_000 });
    return valor;
  }

  private async resolver(
    calle: string,
    numero: string | undefined,
    depto: string | undefined,
    ciudad: string | undefined,
  ): Promise<ResultadoEsquinas> {
    // 1) Nominatim estructurado — street+city+state separados, nunca texto
    //    libre: es lo que evita que "18 de Julio 500, Maldonado" caiga en Aiguá.
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'uy',
    });
    params.set('street', numero ? `${calle} ${numero}` : calle);
    if (ciudad) params.set('city', ciudad);
    if (depto) params.set('state', depto);

    let resultados: NominatimResult[];
    try {
      resultados = (await traerJson(
        `${NOMINATIM}/search?${params.toString()}`,
        TIMEOUT_NOMINATIM,
      )) as NominatimResult[];
    } catch (e) {
      const err = e as Error & { cause?: Error & { code?: string } };
      this.logger.warn(
        `Nominatim no responde: ${err.message}` +
          (err.cause ? ` | causa: ${err.cause.message} ${err.cause.code ?? ''}` : ''),
      );
      return SIN_UBICAR;
    }
    if (!Array.isArray(resultados) || resultados.length === 0) return SIN_UBICAR;

    const mejor = resultados[0];
    const esPortal = mejor.type === 'house' || mejor.place_rank >= 30;
    const lat = Number(mejor.lat);
    const lng = Number(mejor.lon);
    const nombreVia = mejor.address?.road ?? calle;

    // 2) Overpass: intersecciones reales alrededor del punto.
    const esquinas = await this.intersecciones(lat, lng, nombreVia);

    const resultado: ResultadoEsquinas = {
      encontrada: true,
      precision: esPortal ? 'EXACTA' : numero ? 'CALLE' : 'CALLE',
      lat,
      lng,
      calle: nombreVia,
      calid: this.calles.calidDe(nombreVia, depto, ciudad),
      esquina1: esquinas[0]
        ? { nombre: esquinas[0], calid: this.calles.calidDe(esquinas[0], depto, ciudad) }
        : null,
      esquina2: esquinas[1]
        ? { nombre: esquinas[1], calid: this.calles.calidDe(esquinas[1], depto, ciudad) }
        : null,
      barrio: mejor.address?.suburb ?? mejor.address?.neighbourhood ?? null,
      localidad:
        mejor.address?.city ?? mejor.address?.town ?? mejor.address?.village ?? null,
      codigoPostal: mejor.address?.postcode ?? null,
    };
    return resultado;
  }

  /**
   * Las dos esquinas de la cuadra: nodos que la calle comparte con otras
   * calles con nombre, ordenados sobre la vía; se toma la anterior y la
   * siguiente al punto. Devuelve [] o [una] antes que inventar.
   */
  private async intersecciones(
    lat: number,
    lng: number,
    nombreCalle: string,
  ): Promise<string[]> {
    const q = `[out:json][timeout:${Math.floor(TIMEOUT_OVERPASS / 1000)}];way(around:80,${lat},${lng})["highway"]["name"];out body;>;out skel qt;`;
    let elementos: (OverpassWay | OverpassNode)[];
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_OVERPASS);
      try {
        const r = await fetch(`${OVERPASS}/api/interpreter`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: q }).toString(),
        });
        if (!r.ok) return [];
        elementos = ((await r.json()) as { elements: (OverpassWay | OverpassNode)[] })
          .elements;
      } finally {
        clearTimeout(t);
      }
    } catch {
      // Las esquinas son un extra: sin Overpass el resultado sigue sirviendo.
      return [];
    }

    const ways = elementos.filter((e): e is OverpassWay => e.type === 'way');
    const nodos = new Map<number, { lat: number; lng: number }>();
    for (const e of elementos) {
      if (e.type === 'node') nodos.set(e.id, { lat: e.lat, lng: e.lon });
    }

    const objetivo = normalizarCalle(nombreCalle);
    const candidatas = ways.filter(
      (w) => w.tags?.name && normalizarCalle(w.tags.name) === objetivo,
    );
    if (candidatas.length === 0) return [];

    const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const dLat = a.lat - b.lat;
      const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180);
      return dLat * dLat + dLng * dLng;
    };
    const punto = { lat, lng };

    // El tramo que efectivamente pasa por el punto.
    let via = candidatas[0];
    let mejor = Number.POSITIVE_INFINITY;
    for (const w of candidatas) {
      for (const id of w.nodes) {
        const n = nodos.get(id);
        if (n) {
          const d = dist(punto, n);
          if (d < mejor) {
            mejor = d;
            via = w;
          }
        }
      }
    }

    const idsVia = new Set(via.nodes);
    const esquinaPorIndice = new Map<number, string>();
    for (const w of ways) {
      if (w.id === via.id) continue;
      const nombre = w.tags?.name;
      if (!nombre || normalizarCalle(nombre) === objetivo) continue;
      for (const id of w.nodes) {
        if (!idsVia.has(id)) continue;
        const indice = via.nodes.indexOf(id);
        if (indice >= 0 && !esquinaPorIndice.has(indice)) {
          esquinaPorIndice.set(indice, nombre);
        }
      }
    }
    if (esquinaPorIndice.size === 0) return [];

    let indicePunto = 0;
    let mejorD = Number.POSITIVE_INFINITY;
    via.nodes.forEach((id, i) => {
      const n = nodos.get(id);
      if (n) {
        const d = dist(punto, n);
        if (d < mejorD) {
          mejorD = d;
          indicePunto = i;
        }
      }
    });

    const ordenadas = [...esquinaPorIndice.entries()].sort((a, b) => a[0] - b[0]);
    let antes: string | null = null;
    let despues: string | null = null;
    for (const [indice, nombre] of ordenadas) {
      if (indice <= indicePunto) antes = nombre;
      else if (despues === null) despues = nombre;
    }
    if (antes && despues) return [antes, despues];
    if (antes) {
      const resto = ordenadas.filter(([, n]) => n !== antes);
      return resto.length ? [antes, resto[resto.length - 1][1]] : [antes];
    }
    if (despues) {
      const resto = ordenadas.filter(([, n]) => n !== despues);
      return resto.length ? [despues, resto[0][1]] : [despues];
    }
    return [];
  }
}
