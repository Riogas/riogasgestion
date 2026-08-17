import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Cliente HTTP contra `as400-api` (`/api/ficha/*`), que es el único que le
 * habla al AS400. Corre en la misma máquina y NO está expuesto por firewall:
 * por eso el default apunta a 127.0.0.1:5000.
 *
 * Autenticación por `x-api-key` (FICHA_API_KEY). Ningún secreto va hardcodeado.
 */

const URL_POR_DEFECTO = 'http://127.0.0.1:5000';
/** El AS400 puede demorar; 8 s es el techo antes de cortar y avisar. */
const TIMEOUT_MS = 8000;

export interface DireccionAs400 {
  calprinid: number | null;
  nroPuerta: number | null;
  bis: string | null;
  apto: string | null;
  blockSolar: string | null;
  nivel: string | null;
  local: string | null;
  nroManzana: string | null;
  km: number | null;
  dirObs: string | null;
  esq1Id: number | null;
  esq2Id: number | null;
  /** DIRCORX (sí, la X es la latitud). */
  lat: number | null;
  /** DIRCORY. */
  lng: number | null;
  utmX: number | null;
  utmY: number | null;
  fechaGeo: string | null;
  icaMet: number | null;
}

export interface ClienteAs400 {
  cliid: number;
  nombre: string | null;
  estado: string | null;
  tipoId: number | null;
  ruc: string | null;
  email: string | null;
  gci: string | null;
  vip: boolean | null;
  obs: string | null;
  obsComercial: string | null;
  fechaAlta: string | null;
  fecha: string | null;
  ultimaLlamada: string | null;
  operadorAlta: string | null;
  operadorModificacion: string | null;
  direccion: DireccionAs400;
}

export interface SenalesAs400 {
  pedidos12m: number;
  pedidosHist: number;
  ultPedido: {
    fecha: string | null;
    importe: number | null;
    cantidad: number | null;
    producto: string | null;
  } | null;
}

export interface TelefonoAs400 {
  numero: string;
  estado: string | null;
  obs: string | null;
}

/** Valor escribible en una columna del AS400 (`null` limpia el campo). */
export type ValorAs400 = string | number | null;

interface RespuestaApi<T> {
  ok?: boolean;
  error?: string;
  /** as400-api devuelve la lista completa cuando falla la validación de campos. */
  errores?: string[];
  data?: T;
  rows?: T;
  afectados?: number;
  dryRun?: boolean;
  sql?: string;
  valores?: unknown[];
}

/** El "por qué falló" que sirva para arreglarlo, no un "HTTP 400" pelado. */
function detalleDe<T>(cuerpo: RespuestaApi<T>, status: number): string {
  if (Array.isArray(cuerpo.errores) && cuerpo.errores.length > 0) {
    return cuerpo.errores.join('; ');
  }
  return cuerpo.error ?? `HTTP ${status}`;
}

@Injectable()
export class As400Client {
  private readonly logger = new Logger(As400Client.name);

  private get base(): string {
    return (process.env.AS400_API_URL ?? URL_POR_DEFECTO).replace(/\/+$/, '');
  }

  private get apiKey(): string {
    const key = process.env.FICHA_API_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        'FICHA_API_KEY no está configurada en el backend: no se puede hablar con el AS400',
      );
    }
    return key;
  }

  async cliente(cliid: number): Promise<ClienteAs400> {
    const r = await this.pedir<ClienteAs400>(`/api/ficha/cliente/${cliid}`, cliid);
    // Se chequea `direccion` además de `data`: toda la ficha la desarma sin
    // preguntar y un `data` a medias reventaría con un "cannot read of
    // undefined" que no le dice nada a nadie.
    if (!r.data || typeof r.data !== 'object' || !r.data.direccion) {
      throw new ServiceUnavailableException(
        `as400-api devolvió una ficha incompleta para el cliente ${cliid}`,
      );
    }
    return r.data;
  }

  async senales(cliid: number): Promise<SenalesAs400> {
    const r = await this.pedir<SenalesAs400>(`/api/ficha/cliente/${cliid}/senales`, cliid);
    const d = r.data;
    return {
      pedidos12m: typeof d?.pedidos12m === 'number' ? d.pedidos12m : 0,
      pedidosHist: typeof d?.pedidosHist === 'number' ? d.pedidosHist : 0,
      ultPedido: d?.ultPedido ?? null,
    };
  }

  async telefonos(cliid: number): Promise<TelefonoAs400[]> {
    const r = await this.pedir<TelefonoAs400[]>(`/api/ficha/cliente/${cliid}/telefonos`, cliid);
    // Si `rows` no es un array la ficha se caería con un .map críptico: mejor
    // lista vacía y el aviso en el log.
    if (!Array.isArray(r.rows)) {
      if (r.rows !== undefined) {
        this.logger.warn(`as400-api devolvió teléfonos con forma inesperada para ${cliid}`);
      }
      return [];
    }
    return r.rows;
  }

  /**
   * `PATCH` de las columnas ya validadas. Con `dryRun` el AS400 no se toca:
   * as400-api devuelve el SQL y los valores que ejecutaría.
   */
  async actualizar(
    cliid: number,
    campos: Record<string, ValorAs400>,
    dryRun = false,
  ): Promise<{ afectados: number; dryRun?: boolean; sql?: string; valores?: unknown[] }> {
    const r = await this.pedir<never>(`/api/ficha/cliente/${cliid}`, cliid, {
      method: 'PATCH',
      body: JSON.stringify({ campos, dryRun }),
      headers: { 'Content-Type': 'application/json' },
    });
    return {
      afectados: typeof r.afectados === 'number' ? r.afectados : 0,
      dryRun: r.dryRun,
      sql: r.sql,
      valores: r.valores,
    };
  }

  private async pedir<T>(
    ruta: string,
    cliid: number,
    init?: { method?: string; body?: string; headers?: Record<string, string> },
  ): Promise<RespuestaApi<T>> {
    const url = `${this.base}${ruta}`;
    // La key se lee ANTES del try: si falta, el error tiene que salir tal cual
    // ("configurá FICHA_API_KEY") y no disfrazado de "el AS400 no responde".
    const key = this.apiKey;
    let respuesta: Awaited<ReturnType<typeof fetch>>;
    try {
      respuesta = await fetch(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), 'x-api-key': key },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      const detalle = err.name === 'TimeoutError' ? `no respondió en ${TIMEOUT_MS / 1000} s` : err.message;
      this.logger.error(`as400-api ${ruta}: ${detalle} (${err.cause?.code ?? 'sin código'})`);
      throw new ServiceUnavailableException(
        `No se pudo hablar con el AS400 (as400-api ${detalle}). Probá de nuevo en unos segundos.`,
      );
    }

    let cuerpo: RespuestaApi<T> = {};
    try {
      cuerpo = (await respuesta.json()) as RespuestaApi<T>;
    } catch {
      // Un cuerpo ilegible con status ok es tan inservible como un error.
      if (respuesta.ok) {
        throw new ServiceUnavailableException(
          `as400-api devolvió una respuesta ilegible en ${ruta}`,
        );
      }
    }

    if (respuesta.status === 404) {
      throw new NotFoundException(
        cuerpo.error ?? `El cliente ${cliid} no existe en el AS400`,
      );
    }
    // 401/403 no es "el AS400 anda mal": es NUESTRA key. Que el mensaje lo diga,
    // o el de guardia va a buscar el problema del lado equivocado.
    if (respuesta.status === 401 || respuesta.status === 403) {
      this.logger.error(`as400-api ${ruta} rechazó la x-api-key (HTTP ${respuesta.status})`);
      throw new ServiceUnavailableException(
        'as400-api rechazó la credencial del backend: revisá que FICHA_API_KEY sea la misma en los dos lados',
      );
    }
    if (!respuesta.ok || cuerpo.ok === false) {
      const detalle = detalleDe(cuerpo, respuesta.status);
      this.logger.error(`as400-api ${ruta} falló: ${detalle}`);
      throw new ServiceUnavailableException(`El AS400 rechazó la operación: ${detalle}`);
    }
    return cuerpo;
  }
}
