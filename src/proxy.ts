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

// secapi ya no deja pasar /api/db/* sin JWT verificado, así que "la consulta de
// permisos falló" dejó de ser una sola cosa. Hay cuatro desenlaces y cada uno
// pide una salida distinta para el usuario:
//   RESUELTO      → secapi contestó: tiene (o no) el permiso. Es lo único cacheable.
//   SESION_MUERTA → 401 (SIN_TOKEN / TOKEN_INVALIDO / TOKEN_VENCIDO / USUARIO_NO_ENCONTRADO):
//                   el token ya no vale. No es falta de permiso → va a /login.
//   NO_CONFIGURADO→ 503 SECRETO_NO_CONFIGURADO: a secapi le falta el secreto de
//                   firma. Ni el permiso ni el login arreglan esto.
//   SIN_RESPUESTA → timeout, red caída o 5xx genérico: secapi no habló. Acá (y
//                   solo acá) aplica el fallback por caché vencido.
type ResultadoPermiso =
  | { estado: 'RESUELTO'; permitido: boolean }
  | { estado: 'SESION_MUERTA' }
  | { estado: 'NO_CONFIGURADO' }
  | { estado: 'SIN_RESPUESTA' };

// Caché en memoria del chequeo de permisos: secapi se consultaba en CADA
// navegación de forma bloqueante y sin timeout — si secapi andaba lento, toda
// la app quedaba "cargando". El permiso por (token, ruta) cambia poco: se
// cachea con TTL y se refresca recién al vencer.
const PERMISO_TTL_MS = 5 * 60 * 1000; // resultado positivo
const PERMISO_NEG_TTL_MS = 30 * 1000; // negativo: reintenta pronto (alta de permisos)
const PERMISO_FETCH_TIMEOUT_MS = 3500;
const permisoCache = new Map<string, { permitido: boolean; expiresAt: number }>();

// hash corto del token para no retener JWTs completos como keys
async function permisoCacheKey(token: string, pathname: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  const hex = Array.from(new Uint8Array(digest).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex}|${pathname}`;
}

// Devuelve todo menos SIN_RESPUESTA: la caída de secapi se resuelve acá adentro
// (caché vencido o denegar) y no llega al llamador.
async function checkPermisoCached(
  pathname: string,
  code: string,
  token: string
): Promise<Exclude<ResultadoPermiso, { estado: 'SIN_RESPUESTA' }>> {
  const key = await permisoCacheKey(token, pathname);
  const cached = permisoCache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    log('permiso desde caché:', cached.permitido);
    return { estado: 'RESUELTO', permitido: cached.permitido };
  }

  const resultado = await apiCheckPermisoEdge(pathname, code, token);

  if (resultado.estado === 'SIN_RESPUESTA') {
    // secapi caído o timeout: usar último valor conocido aunque esté vencido
    // (mejor stale que bloquear la operativa); sin historia → denegar.
    if (cached) {
      log('secapi no respondió → usando caché vencido:', cached.permitido);
      return { estado: 'RESUELTO', permitido: cached.permitido };
    }
    return { estado: 'RESUELTO', permitido: false };
  }

  if (resultado.estado === 'SESION_MUERTA') {
    // El token está muerto: cualquier veredicto guardado para él es basura.
    // Si no se borra, el usuario vuelve a entrar y durante lo que queda de TTL
    // el caché lo deja navegar con una sesión que secapi ya rechaza.
    permisoCache.delete(key);
    return resultado;
  }

  if (resultado.estado === 'NO_CONFIGURADO') {
    // No se cachea: es un estado del servidor, se arregla afuera y queremos
    // que el próximo request lo vea arreglado enseguida.
    return resultado;
  }

  // Poda simple para que el Map no crezca sin límite
  if (permisoCache.size > 2000) {
    for (const [k, v] of permisoCache) {
      if (v.expiresAt <= now) permisoCache.delete(k);
    }
  }

  permisoCache.set(key, {
    permitido: resultado.permitido,
    expiresAt: now + (resultado.permitido ? PERMISO_TTL_MS : PERMISO_NEG_TTL_MS),
  });
  return resultado;
}

// Clasifica la respuesta de secapi (ver ResultadoPermiso).
async function apiCheckPermisoEdge(
  pathname: string,
  _code: string,
  token: string
): Promise<ResultadoPermiso> {
  try {
    const objetoKey = getObjetoKey(pathname); // p.ej. "clientes"
    const accionKey = 'view';
    const url = `${SECAPI_URL}/api/db/permisos`;

    // Contrato secapi:
    //   body  → { aplicacion, permisos: [{ ObjetoKey, AccionKey, ObjetoPath }] }
    //   resp  → { resultados: [{ accionKey, permitido: 'GRANTED' }] }
    // ObjetoPath = ruta concreta. Necesario para que secapi resuelva rutas
    // dinámicas por patrón (ej. /dashboard/moviles/108 → /moviles/:id) cuando el
    // ObjetoKey (último segmento = el id) no matchea ningún objeto.
    const body = {
      aplicacion: PERMISOS_APLICACION,
      permisos: [
        { ObjetoKey: objetoKey, AccionKey: accionKey, ObjetoPath: pathname },
      ],
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
      signal: AbortSignal.timeout(PERMISO_FETCH_TIMEOUT_MS),
    });

    console.log('[MW] Status:', resp.status, resp.statusText);

    const raw = await resp.text();
    console.log('[MW] Raw body:', raw);

    let json: any = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }

    // 401 = el token no vale (firma vieja, vencido o usuario inexistente).
    // Ojo: esto ES una respuesta de secapi, no una caída → no dispara el
    // fallback por caché; el usuario tiene que volver a loguearse.
    if (resp.status === 401) {
      console.log('[MW] → sesión muerta (401):', json?.error ?? '(sin error)');
      return { estado: 'SESION_MUERTA' };
    }

    // 503 con SECRETO_NO_CONFIGURADO = a secapi le falta JWT_SECRET. Cualquier
    // otro 5xx sí es "secapi no está" y se trata como caída (caché vencido).
    if (resp.status === 503 && json?.error === 'SECRETO_NO_CONFIGURADO') {
      console.error('[MW] → secapi sin secreto de firma configurado');
      return { estado: 'NO_CONFIGURADO' };
    }

    if (resp.status >= 500) {
      console.error('[MW] → secapi devolvió', resp.status, '→ se trata como caída');
      return { estado: 'SIN_RESPUESTA' };
    }

    // 403 y demás respuestas no-ok: secapi contestó y dijo que no.
    if (!resp.ok) return { estado: 'RESUELTO', permitido: false };

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
    return { estado: 'RESUELTO', permitido };
  } catch (err) {
    console.error('[MW] Error checando permiso (timeout/red):', err);
    return { estado: 'SIN_RESPUESTA' };
  }
}

// Pantalla de corte para el 503 SECRETO_NO_CONFIGURADO. Se responde HTML plano
// desde el proxy (no una redirección) a propósito: cualquier ruta a la que lo
// mandemos vuelve a pasar por acá y vuelve a fallar → loop. Sin Tailwind porque
// esto no pasa por el render de la app.
function respuestaSecapiNoConfigurado(): NextResponse {
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Servicio de seguridad no disponible</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;color:#e6e8eb;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <main style="max-width:34rem;padding:2.5rem;border:1px solid #262b33;border-radius:1rem;background:#161a21">
    <h1 style="margin:0 0 .75rem;font-size:1.35rem">Servicio de seguridad no disponible</h1>
    <p style="margin:0 0 .75rem;line-height:1.6;color:#aab2bd">
      SecuritySuite no tiene configurado su secreto de firma, así que no puede validar
      ninguna sesión. No es un problema de tu usuario ni de tus permisos, y volver a
      iniciar sesión no lo soluciona.
    </p>
    <p style="margin:0;line-height:1.6;color:#aab2bd">
      Avisá a Sistemas indicando este código: <code style="background:#0f1115;border:1px solid #262b33;border-radius:.35rem;padding:.15rem .4rem">SECRETO_NO_CONFIGURADO</code>
    </p>
  </main>
</body></html>`;
  return new NextResponse(html, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
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
    // Formulario público de sorteos (QR): sin sesión ni permisos
    pathname === '/sorteo' ||
    pathname.startsWith('/sorteo/') ||
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
  let resultado: Exclude<ResultadoPermiso, { estado: 'SIN_RESPUESTA' }>;

  if (isDevelopment && token?.startsWith('mock-jwt-token')) {
    log('🧪 Token mock detectado en desarrollo - permiso automático');
    resultado = { estado: 'RESUELTO', permitido: true };
  } else {
    resultado = await checkPermisoCached(pathname, code, token);
  }

  log('resultado permiso:', resultado);

  // 4a) Sesión muerta ≠ falta de permiso. Mandarlo a /no-autorizado con la
  // cookie viva era el callejón sin salida: la pantalla no ofrece volver a
  // entrar y refrescar repite el mismo 401. Se borra la cookie (así el próximo
  // request cae en el "sin token → /login" de arriba aunque algo falle) y se
  // avisa a /login con ?sesion=expirada para que limpie localStorage y explique
  // por qué lo sacaron.
  if (resultado.estado === 'SESION_MUERTA') {
    const url = new URL('/login', request.url);
    url.searchParams.set('sesion', 'expirada');
    log('sesión rechazada por secapi → redirect', url.toString());
    const res = NextResponse.redirect(url);
    // Con path explícito: la cookie se creó con path=/ y un borrado sin path
    // usa como default el directorio del request (/dashboard/...), o sea que
    // no la pisa y la sesión muerta sobrevive.
    res.cookies.set('token', '', { path: '/', maxAge: 0 });
    return res;
  }

  // 4b) secapi sin secreto de firma: es un problema de configuración del
  // servidor, no del usuario. No se lo manda a /login (el propio /api/db/login
  // responde 503, quedaría intentando entrar para siempre) ni se le dice "no
  // tenés permiso" (mandaría a pedir un permiso que ya tiene). Tampoco se cae
  // al caché vencido como con secapi caído: sin secreto NINGUNA llamada a
  // secapi de la pantalla va a andar, dejarlo pasar solo esconde la falla más
  // adentro y más difícil de diagnosticar. Se corta acá, con el código a mano
  // para reportarlo.
  if (resultado.estado === 'NO_CONFIGURADO') {
    return respuestaSecapiNoConfigurado();
  }

  const permitido = resultado.permitido;
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
