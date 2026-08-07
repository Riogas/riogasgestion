import * as crypto from 'crypto';
import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
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

    it('rechaza un token de dos partes en vez de saltear la verificación de firma', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ sub: 'u1', exp: 32503680000 })).toString(
        'base64url',
      );
      expect(() => guard.canActivate(ctx({ authorization: `Bearer ${header}.${body}` }))).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('sin JWT_SECRET', () => {
    const nodeEnvOriginal = process.env.NODE_ENV;
    let errores: jest.SpyInstance;
    let avisos: jest.SpyInstance;

    beforeEach(() => {
      // El aviso se emite una sola vez por proceso: se resetea para cada caso.
      (AuthGuard as unknown as { avisoSecretoEmitido: boolean }).avisoSecretoEmitido = false;
      errores = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      avisos = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      delete process.env.JWT_SECRET;
      delete process.env.AUTH_REQUIRE_JWT_SECRET;
    });

    afterEach(() => {
      process.env.NODE_ENV = nodeEnvOriginal;
      delete process.env.AUTH_REQUIRE_JWT_SECRET;
      jest.restoreAllMocks();
    });

    // Goya nunca verificó la firma (el JWT lo emite secapi): sin secreto la API
    // tiene que seguir sirviendo en cualquier ambiente, incluido production, o se
    // cae toda la app. El cierre es opt-in explícito.
    it.each([undefined, '', 'development', 'test', 'staging', 'production'])(
      'NODE_ENV=%s sin el opt-in → sigue autenticando y avisa por log',
      (ambiente) => {
        if (ambiente === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = ambiente;
        const token = makeToken({ sub: 'u1', exp: 32503680000 });
        const req: any = { headers: { authorization: `Bearer ${token}` } };
        const context = {
          switchToHttp: () => ({ getRequest: () => req }),
        } as unknown as ExecutionContext;

        expect(guard.canActivate(context)).toBe(true);
        expect(req.user.sub).toBe('u1');
        expect(errores).not.toHaveBeenCalled();
      },
    );

    it('avisa una sola vez por proceso, no en cada request', () => {
      process.env.NODE_ENV = 'production';
      const token = makeToken({ sub: 'u1', exp: 32503680000 });

      for (let i = 0; i < 3; i++) {
        expect(guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toBe(true);
      }

      expect(avisos).toHaveBeenCalledTimes(1);
      expect(String(avisos.mock.calls[0][0])).toContain('JWT_SECRET');
    });

    describe('con AUTH_REQUIRE_JWT_SECRET=1 (fail-closed opt-in)', () => {
      beforeEach(() => {
        process.env.AUTH_REQUIRE_JWT_SECRET = '1';
      });

      it('rechaza aunque el token esté bien formado y vigente', () => {
        const token = makeToken({ sub: 'u1', exp: 32503680000 });

        expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow(
          UnauthorizedException,
        );
      });

      it('rechaza incluso sin header (no hay forma de autenticar)', () => {
        expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
      });

      it('loguea el error una sola vez', () => {
        const token = makeToken({ sub: 'u1', exp: 32503680000 });

        for (let i = 0; i < 3; i++) {
          expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow();
        }

        expect(errores).toHaveBeenCalledTimes(1);
        expect(String(errores.mock.calls[0][0])).toContain('JWT_SECRET');
      });
    });

    it('con JWT_SECRET seteada, producción funciona normal', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'secreto-de-prod';
      const token = makeSignedToken({ sub: 'u1', exp: 32503680000 }, 'secreto-de-prod');
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
      expect(errores).not.toHaveBeenCalled();
      expect(avisos).not.toHaveBeenCalled();
      delete process.env.JWT_SECRET;
    });
  });
});
