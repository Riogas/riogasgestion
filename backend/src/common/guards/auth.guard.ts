import * as crypto from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

export interface JwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  [k: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Únicos ambientes donde se tolera correr sin JWT_SECRET (tokens mock sin firmar).
 * La lista es explícita a propósito: si NODE_ENV no está seteada, el guard exige el
 * secreto. Confiar en `NODE_ENV === 'production'` dejaba el agujero abierto en
 * silencio en cualquier deploy que se olvidara de setear la variable.
 */
const AMBIENTES_SIN_SECRETO = ['development', 'test'];

/**
 * AuthGuard — verifica el JWT del header Authorization.
 *
 * JWT_SECRET es obligatoria salvo en development/test: sin ella el guard NO puede
 * verificar ninguna firma (cualquiera arma un payload base64 y entra), así que falla
 * cerrado y devuelve 401 a todo. En local se mantiene el comportamiento permisivo de
 * siempre (tokens mock sin firmar) para no romper el flujo de desarrollo.
 * El hardening completo de auth es parte del esfuerzo de seguridad separado.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private static readonly logger = new Logger(AuthGuard.name);

  /** El aviso de JWT_SECRET faltante se loguea una sola vez, no en cada request. */
  private static avisoSecretoEmitido = false;

  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.JWT_SECRET;
    const ambiente = process.env.NODE_ENV ?? '';
    if (!secret && !AMBIENTES_SIN_SECRETO.includes(ambiente)) {
      if (!AuthGuard.avisoSecretoEmitido) {
        AuthGuard.avisoSecretoEmitido = true;
        AuthGuard.logger.error(
          `JWT_SECRET no está configurada (NODE_ENV=${ambiente || 'sin definir'}): la API queda cerrada ` +
            '(401 en todos los endpoints autenticados). Seteá JWT_SECRET con el mismo secreto con el que ' +
            'secapi firma los JWT; en una máquina de desarrollo, NODE_ENV=development.',
        );
      }
      throw new UnauthorizedException('Autenticación no disponible: JWT_SECRET no configurada');
    }

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    const token = header.slice('Bearer '.length).trim();

    const parts = token.split('.');
    if (secret) {
      // Nunca saltear la verificación por la forma del token: un token de dos
      // partes no es "sin firma", es un token inválido.
      if (parts.length !== 3) {
        throw new UnauthorizedException('Firma inválida');
      }

      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');

      const expectedBuf = Buffer.from(expectedSig);
      const actualBuf = Buffer.from(parts[2]);

      if (expectedBuf.length !== actualBuf.length) {
        throw new UnauthorizedException('Firma inválida');
      }
      if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        throw new UnauthorizedException('Firma inválida');
      }
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      throw new UnauthorizedException('Token inválido');
    }
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Token expirado');
    }
    req.user = payload;
    return true;
  }
}
