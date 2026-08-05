import { test, expect } from '@playwright/test';

/**
 * Regresión del proxy `/api/[...path]`: los "null body status" (204/205/304).
 *
 * El proxy armaba `new NextResponse(buffer, { status })` para TODAS las
 * respuestas. Con 204/205/304 el constructor de Response tira TypeError, y como
 * el throw ocurría adentro del executor de la Promise nadie la resolvía: el
 * request quedaba colgado hasta el timeout del cliente (+ uncaughtException en
 * el server). Se disparaba con cualquier GET revalidado — el browser manda
 * `If-None-Match` y Express contesta 304 — y en Sorteos dejaba el detalle
 * (`/dashboard/sorteos/:id`) en skeleton para siempre al recargar.
 *
 * Asume el front (4000) y el backend Nest (3001) levantados, y un JWT de admin
 * en `E2E_ADMIN_TOKEN`. Sin esa env los tests se saltean.
 *
 *   # backend con NODE_ENV=development acepta un JWT sin firmar verificada
 *   TOKEN=$(node -e "const p=Buffer.from(JSON.stringify({sub:'e2e',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');console.log('mock-jwt-token.'+p+'.x')")
 *   E2E_ADMIN_TOKEN=$TOKEN npx playwright test tests/api-proxy-304.spec.ts --project=chromium
 *
 * Son tests de solo lectura: no crean ni modifican nada.
 */
const TOKEN = process.env.E2E_ADMIN_TOKEN;

/** Cualquier GET autenticado que Express sirva con ETag estable sirve. */
const RECURSO = '/api/sorteos';

test.describe('Proxy /api — null body status', () => {
  test('un 304 del backend se reenvía como 304 y no cuelga el request', async ({
    request,
  }) => {
    test.skip(!TOKEN, 'Seteá E2E_ADMIN_TOKEN con un JWT de admin');

    const headers = { Authorization: `Bearer ${TOKEN}` };

    // 1) Primera pasada: 200 + ETag.
    const primera = await request.get(RECURSO, { headers });
    expect(primera.status()).toBe(200);

    const etag = primera.headers()['etag'];
    expect(etag, 'el backend tiene que mandar ETag para poder revalidar').toBeTruthy();

    // 2) Revalidación: el backend contesta 304 y el proxy tiene que devolverlo
    //    tal cual. Antes del fix esto se colgaba hasta el timeout.
    const revalidada = await request.get(RECURSO, {
      headers: { ...headers, 'If-None-Match': etag },
      timeout: 15000,
    });

    expect(revalidada.status()).toBe(304);
    expect(await revalidada.body()).toHaveLength(0);
  });

  test('sin If-None-Match el mismo recurso sigue devolviendo 200 con body', async ({
    request,
  }) => {
    test.skip(!TOKEN, 'Seteá E2E_ADMIN_TOKEN con un JWT de admin');

    const resp = await request.get(RECURSO, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: 15000,
    });

    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(Array.isArray(json.items)).toBe(true);
  });
});
