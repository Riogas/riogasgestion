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
 * Cierra la API cuando falta JWT_SECRET. Es opt-in explícito (`AUTH_REQUIRE_JWT_SECRET=1`)
 * y no se deduce de NODE_ENV: Goya nunca verificó la firma (el JWT lo emite secapi), así
 * que deducirlo dejaba sin servicio a los ambientes que ya venían corriendo sin secreto.
 * Activarlo requiere primero configurar el MISMO secreto con el que secapi firma; si no
 * coincide, los tokens legítimos pasan a rebotar por "Firma inválida".
 */
function exigeSecreto(): boolean {
  return process.env.AUTH_REQUIRE_JWT_SECRET === '1';
}

/**
 * AuthGuard — verifica el JWT del header Authorization.
 *
 * Con JWT_SECRET configurada se verifica la firma HMAC-SHA256. Sin ella no hay forma de
 * verificar nada (cualquiera arma un payload base64 y entra): se avisa por log al arrancar
 * y, si `AUTH_REQUIRE_JWT_SECRET=1`, se falla cerrado con 401.
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
    if (!secret) {
      if (!AuthGuard.avisoSecretoEmitido) {
        AuthGuard.avisoSecretoEmitido = true;
        const cerrada = exigeSecreto();
        AuthGuard.logger[cerrada ? 'error' : 'warn'](
          `JWT_SECRET no está configurada (NODE_ENV=${ambiente || 'sin definir'}): las firmas de los JWT ` +
            `NO se verifican${cerrada ? ', y con AUTH_REQUIRE_JWT_SECRET=1 la API queda cerrada (401)' : ''}. ` +
            'Seteá JWT_SECRET con el mismo secreto con el que secapi firma los JWT.',
        );
      }
      if (exigeSecreto()) {
        throw new UnauthorizedException('Autenticación no disponible: JWT_SECRET no configurada');
      }
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
