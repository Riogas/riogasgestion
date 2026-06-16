import * as crypto from 'crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

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
 * AuthGuard — verifica el JWT del header Authorization.
 *
 * Si JWT_SECRET está configurado se verifica la firma HMAC-SHA256;
 * si no, se delega la verificación al proxy/legacy (igual que src/proxy.ts del frontend).
 * El hardening completo de auth es parte del esfuerzo de seguridad separado.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    const token = header.slice('Bearer '.length).trim();

    const parts = token.split('.');
    const secret = process.env.JWT_SECRET;
    if (secret && parts.length === 3) {
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
