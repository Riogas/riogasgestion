// src/proxy.ts — renamed from middleware.ts for Next 16 convention.
// All log prefixes ('[MW]') retained intentionally for log continuity.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// =========================
// Config
// =========================
const DEBUG = process.env.DEBUG_MW === '1';

// Rutas públicas que no requieren permisos
const PUBLIC_PATHS = ['/', '/login', '/no-autorizado', '/dashboard'];

// API de permisos: ahora vía secapi (SecuritySuite), igual que login/menú.
const SECAPI_URL = (
  process.env.SECAPI_URL || 'https://secapi-dev.glp.riogas.com.uy'
).replace(/\/$/, '');
// Nombre de la aplicación registrada en SecuritySuite (NO el id numérico).
const PERMISOS_APLICACION =
  process.env.PERMISOS_APLICACION || process.env.LOGIN_SISTEMA || 'GOYA';

// Salt para generar códigos de pantalla (cambiarlo regenera todos los códigos)
const ROUTE_SALT = process.env.ROUTE_SALT ?? 's';

// (opcional) nombre amigable por ruta
const ROUTE_META: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /^\/dashboard$/, name: 'Dashboard' },
  { pattern: /^\/usuarios$/, name: 'Usuarios' },
  { pattern: /^\/pedidos$/, name: 'Pedidos' },
  { pattern: /^\/pedidos\/[^/]+$/, name: 'Detalle de Pedido' },
];

// =========================
// Utils (scope de módulo)
// =========================
function log(...args: any[]) {
  if (DEBUG) console.log('[MW]', ...args);
}

function routeName(pathname: string): string {
  return ROUTE_META.find((m) => m.pattern.test(pathname))?.name ?? pathname;
}

// ejemplo: "/dashboard/clientes" → "clientes"
function getObjetoKey(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : 'root';
}

// Genera un código estable por ruta: XXXX-XXXX (Edge-safe usando Web Crypto)
async function routeCode(
  pathname: string,
  salt: string = ROUTE_SALT
): Promise<string> {
  const enc = new TextEncoder().encode(`${salt}|${pathname}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  const bytes = new Uint8Array(digest);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0,
    value = 0,
    out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  const code = out.replace(/[^A-Z2-7]/g, '').slice(0, 8) || 'AAAAAAAA';
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

// Decodifica el payload de un JWT (sin verificar firma) — Edge-safe
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payloadB64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// =========================
// API de permisos
// =========================
async function apiCheckPermisoEdge(
  pathname: string,
  _code: string,
  token: string
): Promise<boolean> {
  try {
    const objetoKey = getObjetoKey(pathname); // p.ej. "clientes"
    const accionKey = 'view';
    const url = `${SECAPI_URL}/api/db/permisos`;

    // Contrato secapi (igual que TrackMovil):
    //   body  → { aplicacion, permisos: [{ ObjetoKey, AccionKey }] }
    //   resp  → { resultados: [{ accionKey, permitido: 'GRANTED' }] }
    const body = {
      aplicacion: PERMISOS_APLICACION,
      permisos: [{ ObjetoKey: objetoKey, AccionKey: accionKey }],
    };

    console.log('[MW] → Checando permiso (secapi)');
    console.log('[MW] URL:', url);
    console.log('[MW] Body enviado:', body);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    console.log('[MW] Status:', resp.status, resp.statusText);

    const raw = await resp.text();
    console.log('[MW] Raw body:', raw);

    if (!resp.ok) return false;

    let json: any = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      return false;
    }

    const resultados: any[] = Array.isArray(json?.resultados)
      ? json.resultados
      : Array.isArray(json)
      ? json
      : [];

    // Buscar el resultado de nuestra acción; si no viene tipado, usar el primero.
    const match =
      resultados.find(
        (r) => (r?.accionKey ?? r?.AccionKey) === accionKey
      ) ?? resultados[0];

    const val = match?.permitido ?? match?.Permitido;
    const permitido =
      val === 'GRANTED' || val === true || val === 'S' || val === 'GRANTED';

    console.log('[MW] → permitido?', permitido);
    return permitido;
  } catch (err) {
    console.error('[MW] Error checando permiso:', err);
    return false;
  }
}

// =========================
// Proxy (renamed from middleware in Next 16)
// =========================
export async function proxy(request: NextRequest) {
  console.log('[MW] DEBUG_MW =', process.env.DEBUG_MW);

  const { pathname } = request.nextUrl;
  log('→ request', pathname);

  // 1) Excluir assets/sistema y rutas públicas sin chequear
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    /\.[a-zA-Z0-9]+$/.test(pathname) // archivos de /public (png, svg, js, css, etc.)
  ) {
    log('ruta pública / asset → Next()');
    const res = NextResponse.next();
    res.headers.set('x-mw-hit', 'public');
    return res;
  }

  // 2) JWT desde cookie
  const token = request.cookies.get('token')?.value;
  log('token presente?', !!token);
  log('todas las cookies:', Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value])));
  if (!token) {
    log('sin token → redirect /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3) Datos de pantalla
  const [code, name] = await Promise.all([
    routeCode(pathname),
    Promise.resolve(routeName(pathname)),
  ]);
  log('code/name calculados:', code, name);

  // 3b) Usuario del JWT (opcional para headers/cookies)
  let userName = '';
  const payload = decodeJwtPayload(token);
  if (payload) {
    userName =
      payload.name ||
      payload.username ||
      payload.email ||
      payload.preferred_username ||
      '';
  }
  log('userName decodificado:', userName || '(vacío)');

  // 4) Consultar permisos con pathname + code + token  ✅
  // En desarrollo, permitir tokens mock
  const isDevelopment = process.env.NODE_ENV === 'development';
  let permitido = false;
  
  if (isDevelopment && token?.startsWith('mock-jwt-token')) {
    log('🧪 Token mock detectado en desarrollo - permiso automático');
    permitido = true;
  } else {
    permitido = await apiCheckPermisoEdge(pathname, code, token);
  }
  
  log('permiso?', permitido);

  if (!permitido) {
    const url = new URL('/no-autorizado', request.url);
    url.searchParams.set('code', code);
    url.searchParams.set('ruta', pathname);
    url.searchParams.set('nombre', name);
    log('NO permitido → redirect', url.toString());
    return NextResponse.redirect(url);
  }

  // 5) Permiso OK → Inyectar headers y cookies espejo
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set('x-route-code', code);
  reqHeaders.set('x-route-name', name);
  if (userName) reqHeaders.set('x-user-name', userName);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('x-mw-hit', '1');
  res.headers.set('x-route-code', code);
  res.headers.set('x-route-name', name);
  if (userName) res.headers.set('x-user-name', userName);

  res.cookies.set('routeCode', code, { path: '/' });
  res.cookies.set('routeName', name, { path: '/' });
  if (userName) res.cookies.set('userName', userName, { path: '/' });

  log('headers set:', {
    'x-route-code': code,
    'x-route-name': name,
    'x-user-name': userName || '(no-set)',
  });

  return res;
}

// 6) Aplicar a todas las rutas menos APIs y estáticos
// Excluye /api, /_next y cualquier archivo con extensión
export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
