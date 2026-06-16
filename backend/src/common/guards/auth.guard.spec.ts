import * as crypto from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, decodeJwtPayload } from './auth.guard';

function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.firma`;
}

function makeSignedToken(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function ctx(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  it('rechaza cuando no hay header Authorization', () => {
    expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
  });

  it('rechaza cuando el token está expirado', () => {
    const token = makeToken({ sub: 'u1', exp: 1000 }); // 1970, expirado
    expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow(
      UnauthorizedException,
    );
  });

  it('acepta un token válido no expirado y adjunta el payload', () => {
    const token = makeToken({ sub: 'u1', exp: 32503680000 }); // año 3000
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(req.user.sub).toBe('u1');
  });

  it('decodeJwtPayload devuelve null ante basura', () => {
    expect(decodeJwtPayload('no-es-un-jwt')).toBeNull();
  });

  describe('con JWT_SECRET configurado', () => {
    const SECRET = 'test-secret-key';

    beforeEach(() => {
      process.env.JWT_SECRET = SECRET;
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('acepta un token firmado correctamente con HMAC', () => {
      const token = makeSignedToken({ sub: 'u1', exp: 32503680000 }, SECRET);
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;
      expect(guard.canActivate(context)).toBe(true);
      expect(req.user.sub).toBe('u1');
    });

    it('rechaza un token con firma incorrecta lanzando UnauthorizedException', () => {
      const token = makeSignedToken({ sub: 'u1', exp: 32503680000 }, 'wrong-secret');
      expect(() =>
        guard.canActivate(ctx({ authorization: `Bearer ${token}` })),
      ).toThrow(UnauthorizedException);
    });
  });
});
