import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, decodeJwtPayload } from './auth.guard';

function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.firma`;
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
});
