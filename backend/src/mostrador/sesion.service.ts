import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Sesiones cortas para la ficha de mostrador.
 *
 * El shell (FichaGoya.exe) pide un token con la api-key y la UI lo lleva en la
 * URL (`?t=`): así la key nunca viaja al navegador. El token queda atado a UN
 * cliid, así que aunque se filtre no sirve para pasearse por el padrón.
 *
 * El estado vive en memoria a propósito: todos los PM2 corren en fork_mode con
 * una sola instancia (hecho verificado), no hay segundo proceso que quede sin
 * ver el Map. Si algún día se escala a cluster, esto pasa a Redis.
 */

/** 30 minutos: lo que dura una atención de mostrador con margen. */
const TTL_MS = 30 * 60 * 1000;
/** El AS400 guarda el operador en CHAR(15). */
const LARGO_OPERADOR = 15;
const INTERVALO_LIMPIEZA_MS = 5 * 60 * 1000;
/**
 * Techo del Map. Los mostradores de toda la empresa no llegan ni de lejos a
 * este número; está para que quien tenga la api-key no pueda inflar la memoria
 * del proceso pidiendo tokens en loop.
 */
const MAX_SESIONES = 5000;

export interface SesionMostrador {
  cliid: number;
  operador: string;
  /** Epoch ms en el que el token deja de servir. */
  expira: number;
}

@Injectable()
export class SesionService implements OnModuleDestroy {
  private readonly logger = new Logger(SesionService.name);
  private readonly sesiones = new Map<string, SesionMostrador>();
  private readonly limpieza: NodeJS.Timeout;

  constructor() {
    this.limpieza = setInterval(() => this.limpiar(), INTERVALO_LIMPIEZA_MS);
    // Sin unref() el proceso no cierra nunca (rompe los deploys y los tests).
    this.limpieza.unref();
  }

  onModuleDestroy() {
    clearInterval(this.limpieza);
  }

  /** Normaliza como lo espera CLIOPUPD: MAYÚSCULAS, sin espacios al borde, 15 caracteres. */
  static normalizarOperador(operador: string): string {
    return String(operador ?? '')
      .trim()
      .toUpperCase()
      .slice(0, LARGO_OPERADOR);
  }

  crear(cliid: number, operador: string): { token: string; sesion: SesionMostrador } {
    // El operador es lo único que queda en CLIOPUPD: si se normaliza a vacío
    // (llegó " " o basura), la escritura perdería la trazabilidad. Se corta acá.
    const normalizado = SesionService.normalizarOperador(operador);
    if (!normalizado) {
      throw new BadRequestException(
        'Falta el operador: la ficha se abre con el usuario que la está atendiendo',
      );
    }
    if (!Number.isSafeInteger(cliid) || cliid <= 0) {
      throw new BadRequestException(`El cliente ${cliid} no es un CLIID válido`);
    }

    if (this.sesiones.size >= MAX_SESIONES) {
      this.limpiar();
      if (this.sesiones.size >= MAX_SESIONES) {
        this.logger.error(
          `Tope de sesiones de mostrador alcanzado (${MAX_SESIONES}): no se emiten tokens nuevos`,
        );
        throw new ServiceUnavailableException(
          'Hay demasiadas fichas abiertas en este momento: probá de nuevo en unos minutos',
        );
      }
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const sesion: SesionMostrador = {
      cliid,
      operador: normalizado,
      expira: Date.now() + TTL_MS,
    };
    this.sesiones.set(token, sesion);
    this.logger.log(
      `Sesión de mostrador para cliente ${cliid} (operador ${sesion.operador}), vence en ${TTL_MS / 60000} min`,
    );
    return { token, sesion };
  }

  /**
   * Devuelve la sesión o `null`. Con `cliid` verifica además que el token sea
   * de ESE cliente: un token de mostrador no habilita a mirar otra ficha.
   */
  validar(token: string, cliid?: number): SesionMostrador | null {
    if (!token) return null;
    const sesion = this.sesiones.get(token);
    if (!sesion) return null;
    if (sesion.expira <= Date.now()) {
      this.sesiones.delete(token);
      return null;
    }
    if (cliid !== undefined && sesion.cliid !== cliid) return null;
    return sesion;
  }

  /** Cuántas sesiones vivas hay (para el health/diagnóstico). */
  activas(): number {
    return this.sesiones.size;
  }

  private limpiar(): void {
    const ahora = Date.now();
    let borradas = 0;
    for (const [token, sesion] of this.sesiones) {
      if (sesion.expira <= ahora) {
        this.sesiones.delete(token);
        borradas++;
      }
    }
    if (borradas > 0) {
      this.logger.debug(`Sesiones de mostrador vencidas eliminadas: ${borradas}`);
    }
  }
}
