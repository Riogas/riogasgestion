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

  describe('sin JWT_SECRET fuera de development/test (fail-closed)', () => {
    const nodeEnvOriginal = process.env.NODE_ENV;
    let errores: jest.SpyInstance;

    beforeEach(() => {
      // El aviso se emite una sola vez por proceso: se resetea para cada caso.
      (AuthGuard as unknown as { avisoSecretoEmitido: boolean }).avisoSecretoEmitido = false;
      errores = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      delete process.env.JWT_SECRET;
    });

    afterEach(() => {
      process.env.NODE_ENV = nodeEnvOriginal;
      jest.restoreAllMocks();
    });

    it('rechaza aunque el token esté bien formado y vigente', () => {
      process.env.NODE_ENV = 'production';
      const token = makeToken({ sub: 'u1', exp: 32503680000 });

      expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza incluso sin header (no hay forma de autenticar)', () => {
      process.env.NODE_ENV = 'production';

      expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
    });

    // El fail-closed no puede depender de que alguien se acuerde de setear NODE_ENV:
    // sin la variable (o con un valor cualquiera) el secreto sigue siendo obligatorio.
    it.each([undefined, '', 'staging', 'prod', 'produccion', 'PRODUCTION'])(
      'NODE_ENV=%s sin JWT_SECRET → 401',
      (ambiente) => {
        if (ambiente === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = ambiente;
        const token = makeToken({ sub: 'u1', exp: 32503680000 });

        expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow(
          UnauthorizedException,
        );
      },
    );

    it('NODE_ENV=test sigue permitiendo el token mock (así corre la suite)', () => {
      process.env.NODE_ENV = 'test';
      const token = makeToken({ sub: 'u1', exp: 32503680000 });
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
    });

    it('loguea el error una sola vez, no en cada request', () => {
      process.env.NODE_ENV = 'production';
      const token = makeToken({ sub: 'u1', exp: 32503680000 });

      for (let i = 0; i < 3; i++) {
        expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow();
      }

      expect(errores).toHaveBeenCalledTimes(1);
      expect(String(errores.mock.calls[0][0])).toContain('JWT_SECRET');
    });

    it('fuera de producción sigue aceptando el token mock de desarrollo', () => {
      process.env.NODE_ENV = 'development';
      const token = makeToken({ sub: 'u1', exp: 32503680000 });
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
      expect(req.user.sub).toBe('u1');
      expect(errores).not.toHaveBeenCalled();
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
      delete process.env.JWT_SECRET;
    });
  });
});
