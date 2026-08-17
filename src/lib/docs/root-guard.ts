// Gate root del portal de documentación (/dashboard/docs y /api/docs/*).
//
// Dos verificaciones, en este orden:
//
//   1) LOCAL — firma y vencimiento del JWT (jsonwebtoken, HS256, con el mismo
//      JWT_SECRET con el que secapi firma). El resto de la app NO verifica la
//      firma: `decodeJwtPayload` es base64 puro, así que cualquiera fabrica un
//      "Bearer xxx.<base64 de {"username":"dmedaglia"}>.yyy" y pasa. Para este
//      portal eso es inaceptable: la pantalla lista qué endpoints están sin
//      autenticación. Se cierra SOLO acá, sin tocar la autenticación general.
//      Es local y va primero para no gastar una llamada de red con un token
//      que ni siquiera está firmado.
//
//   2) REMOTA — el permiso docs:view contra secapi. El JWT de secapi NO lleva
//      el flag root en el payload ({iss, username, userId, sistema}): decidir
//      "es root" leyendo el token es imposible, hay que preguntar. Se consulta
//      el mismo endpoint que ya usa el gate de páginas en src/proxy.ts
//      (POST {SECAPI_URL}/api/db/permisos), con el mismo shape de body.
//
// FAIL-CLOSED EN TODO, incluida la mala configuración:
//   - sin JWT_SECRET (o con el default público del código) → 503, no abre.
//   - sin SECAPI_URL                                        → 503, no abre.
//   - secapi caído / timeout                                → 503, no abre.
// El proxy de páginas (src/proxy.ts), si secapi no responde, sirve el último
// valor cacheado aunque esté vencido para no trabar la operativa. Acá no: si no
// se puede verificar que quien entra es root, no se abre.
//
// Contrato:  requireRoot(request) → { ok: true, usuario } | { ok: false, status, code }
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

/**
 * Default público que trae el código de secapi cuando `JWT_SECRET` no está
 * seteada. Verificar contra él no verifica nada: está en el repo. Se trata
 * igual que "no configurada".
 */
const SECRETO_DEFAULT = "security-suite-secret-key";

/** Largo mínimo exigido al secreto. Ver el comentario en `secretoJwt()`. */
const LARGO_MINIMO_SECRETO = 32;

/** secapi firma HS256; fijar el algoritmo evita la confusión de `alg`. */
const ALGORITMOS: jwt.Algorithm[] = ["HS256"];

// goya = 3; mismo fallback que src/app/api/auth/menuApp/route.ts
const APLICACION_ID = (() => {
  const n = Number(process.env.NEXT_PUBLIC_APLICACION_ID ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

// Objeto/acción dados de alta en secapi el 2026-08-17 (objeto 30, acción 125,
// funcionalidad 62 otorgada al rol Root 55 de GOYA).
const OBJETO_KEY = "docs";
const ACCION_KEY = "view";

const TTL_OK_MS = 5 * 60 * 1000; // resultado positivo
const TTL_DENY_MS = 30 * 1000; // negativo: reintenta pronto (alta de permisos)
const TIMEOUT_MS = 3500;

export interface UsuarioDocs {
  /** username del payload YA VERIFICADO (firma y vencimiento). */
  username: string;
  /** razón que devolvió secapi: ROOT, ROL_FUNCIONALIDAD, DIRECT_ACCESO, … */
  razon: string;
}

export type ResultadoRoot =
  | { ok: true; usuario: UsuarioDocs }
  | { ok: false; status: number; code: string };

/**
 * Lo mínimo que el guard necesita del request. `NextRequest` lo cumple; el
 * adaptador de `requireRootDesdeCookies()` y los tests también.
 */
export interface SolicitudConCredenciales {
  headers: { get(nombre: string): string | null };
  cookies?: { get(nombre: string): { value: string } | undefined };
}

// ── Configuración (se lee en cada request, no al importar el módulo) ─────────

/**
 * Secreto con el que secapi firma los JWT. Devuelve null —y el guard responde
 * 503— si falta o si es el default público del código: sin secreto real la
 * verificación de firma es teatro.
 */
function secretoJwt(): string | null {
  const bruto = (process.env.JWT_SECRET ?? "").trim();
  if (!bruto || bruto === SECRETO_DEFAULT) return null;
  // Verificar HS256 contra un secreto corto no prueba nada: se rompe offline a
  // partir de cualquier token capturado, y con el secreto se firma un token de
  // root a mano — el ataque que este guard viene a cerrar.
  if (bruto.length < LARGO_MINIMO_SECRETO) return null;
  return bruto;
}

/**
 * Host de secapi. Sin fallback hardcodeado a propósito: un default apuntando a
 * dev verifica contra el servidor equivocado, y en un ambiente mal configurado
 * eso abre el portal contra el padrón de otro. Si falta, 503.
 */
function urlSecapi(): string | null {
  const bruto = (process.env.SECAPI_URL ?? "").trim();
  if (!bruto) return null;
  return bruto.replace(/\/$/, "");
}

// ── Caché en memoria ────────────────────────────────────────────────────────
// Igual que en src/proxy.ts: la key es un hash corto del token (no se retienen
// JWTs completos) y el TTL evita pegarle a secapi en cada request de la página.
// Sólo cachea el resultado del PERMISO: la firma y el vencimiento se verifican
// siempre, así que un token vencido no entra por la caché de cuando era válido.
type EntradaCache = { permitido: boolean; razon: string; expiraEn: number };
const cache = new Map<string, EntradaCache>();

async function claveCache(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sólo para los tests: vacía la caché entre casos. */
export function limpiarCacheDocs(): void {
  cache.clear();
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Token de la sesión: header `Authorization: Bearer …` o, si no vino, la
 * cookie `token`. Se exporta porque el ejecutor del "probar"
 * (try-ejecutor.ts) reenvía ESE token al endpoint que se está probando: la
 * llamada sale con la sesión del root, nunca con credenciales del cliente.
 */
export function extraerToken(request: SolicitudConCredenciales): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return request.cookies?.get("token")?.value ?? null;
}

type PayloadJwt = Record<string, unknown>;

type Verificacion =
  | { ok: true; payload: PayloadJwt }
  | { ok: false; status: number; code: string };

/**
 * Verifica firma HS256 + `exp` con el secreto de secapi. NO hace red.
 *
 *   TokenExpiredError  → 401 TOKEN_VENCIDO
 *   JsonWebTokenError  → 401 TOKEN_INVALIDO  (firma que no cierra, token
 *                        malformado, alg distinto de HS256, `nbf` en el futuro)
 */
function verificarToken(token: string, secreto: string): Verificacion {
  try {
    const payload = jwt.verify(token, secreto, { algorithms: ALGORITMOS });
    // Un JWT con payload string (no JSON) no sirve para identificar a nadie.
    if (typeof payload !== "object" || payload === null) {
      return { ok: false, status: 401, code: "TOKEN_INVALIDO" };
    }
    return { ok: true, payload: payload as PayloadJwt };
  } catch (err) {
    // TokenExpiredError extiende JsonWebTokenError: primero el específico.
    if (err instanceof jwt.TokenExpiredError) {
      return { ok: false, status: 401, code: "TOKEN_VENCIDO" };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return { ok: false, status: 401, code: "TOKEN_INVALIDO" };
    }
    // `jwt.verify` también tira TypeError si el token no es un string.
    return { ok: false, status: 401, code: "TOKEN_INVALIDO" };
  }
}

function usernameDelPayload(payload: PayloadJwt): string {
  const bruto =
    payload.username ??
    payload.sub ??
    payload.name ??
    payload.email ??
    payload.preferred_username;
  return typeof bruto === "string" ? bruto : "";
}

/**
 * Consulta a secapi. Devuelve null si no contestó (red/timeout/500): ese null
 * es lo que dispara el fail-closed, y NUNCA se cachea.
 */
async function consultarSecapi(
  token: string,
  secapi: string,
): Promise<{ permitido: boolean; razon: string } | null> {
  try {
    // Mismo contrato que src/proxy.ts:
    //   body → { AplicacionId, permisos: [{ ObjetoKey, AccionKey }] }
    //   resp → { resultados: [{ accionKey, permitido: 'GRANTED'|'DENIED', razon }] }
    // secapi acepta tanto `aplicacion` (nombre) como `AplicacionId` (número);
    // acá se usa el id porque el alta del objeto docs se hizo por id de app.
    const resp = await fetch(`${secapi}/api/db/permisos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        AplicacionId: APLICACION_ID,
        permisos: [{ ObjetoKey: OBJETO_KEY, AccionKey: ACCION_KEY }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    // El status HTTP manda sobre el cuerpo. Sin esto, una respuesta 403 (o
    // cualquier no-2xx) que traiga permitido:"GRANTED" en el body abriría el
    // portal: el cuerpo de una respuesta de error no es una autorización.
    // 5xx es "no pude verificar" → fail-closed (503). El resto deniega.
    if (resp.status >= 500) return null;
    if (!resp.ok) return { permitido: false, razon: `HTTP_${resp.status}` };

    const texto = await resp.text();
    let json: Record<string, unknown> = {};
    try {
      json = texto ? JSON.parse(texto) : {};
    } catch {
      return { permitido: false, razon: "RESPUESTA_INVALIDA" };
    }

    const resultados: Array<Record<string, unknown>> = Array.isArray(
      (json as { resultados?: unknown }).resultados,
    )
      ? ((json as { resultados: Array<Record<string, unknown>> }).resultados)
      : Array.isArray(json)
        ? (json as unknown as Array<Record<string, unknown>>)
        : [json];

    const match =
      resultados.find((r) => (r?.accionKey ?? r?.AccionKey) === ACCION_KEY) ??
      resultados[0];

    const valor = match?.permitido ?? match?.Permitido;
    const razon = typeof match?.razon === "string" ? match.razon : "SIN_RAZON";

    // Sólo GRANTED abre. Cualquier otra cosa deniega.
    return { permitido: valor === "GRANTED", razon };
  } catch (err) {
    console.error("[docs/root-guard] secapi no respondió:", (err as Error)?.message);
    return null;
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Verifica que el request traiga un JWT realmente firmado y vigente, y que ese
 * usuario tenga docs:view en GOYA.
 *
 * Códigos devueltos:
 *   401 NO_TOKEN                  → no vino JWT ni por header ni por cookie
 *   401 TOKEN_INVALIDO            → firma que no cierra / malformado / alg ≠ HS256
 *   401 TOKEN_VENCIDO             → `exp` pasado
 *   403 NO_ROOT                   → secapi contestó DENIED
 *   503 SECRETO_NO_CONFIGURADO    → falta JWT_SECRET (o es el default del código)
 *   503 SECAPI_URL_NO_CONFIGURADA → falta SECAPI_URL
 *   503 SECAPI_INACCESIBLE        → secapi caído/timeout: no se pudo verificar → deniega
 */
export async function requireRoot(
  request: SolicitudConCredenciales | NextRequest,
): Promise<ResultadoRoot> {
  const token = extraerToken(request as SolicitudConCredenciales);
  if (!token) return { ok: false, status: 401, code: "NO_TOKEN" };

  // Mala configuración = fail-closed. Sin secreto real no hay nada que verificar.
  const secreto = secretoJwt();
  if (!secreto) {
    console.error(
      "[docs/root-guard] JWT_SECRET ausente o igual al default del código: el portal /docs " +
        "queda cerrado (503). Seteála con el mismo valor con el que secapi firma los JWT.",
    );
    return { ok: false, status: 503, code: "SECRETO_NO_CONFIGURADO" };
  }

  // Verificación LOCAL primero: un token sin firma válida no merece una llamada
  // de red. Y va antes de la caché, así un token vencido nunca entra
  // aprovechando el GRANTED cacheado de cuando estaba vigente.
  const verificado = verificarToken(token, secreto);
  if (!verificado.ok) return verificado;

  const secapi = urlSecapi();
  if (!secapi) {
    console.error(
      "[docs/root-guard] SECAPI_URL no está seteada: el portal /docs queda cerrado (503).",
    );
    return { ok: false, status: 503, code: "SECAPI_URL_NO_CONFIGURADA" };
  }

  const username = usernameDelPayload(verificado.payload);
  const clave = await claveCache(token);
  const ahora = Date.now();
  const cacheado = cache.get(clave);

  if (cacheado && cacheado.expiraEn > ahora) {
    return cacheado.permitido
      ? { ok: true, usuario: { username, razon: cacheado.razon } }
      : { ok: false, status: 403, code: "NO_ROOT" };
  }

  const respuesta = await consultarSecapi(token, secapi);

  // FAIL-CLOSED: sin respuesta de secapi no se abre, ni siquiera con caché
  // vencida. Y no se cachea el fallo, para reintentar en el request siguiente.
  if (respuesta === null) {
    return { ok: false, status: 503, code: "SECAPI_INACCESIBLE" };
  }

  // Poda simple para que el Map no crezca sin límite (mismo criterio que proxy.ts)
  if (cache.size > 500) {
    for (const [k, v] of cache) if (v.expiraEn <= ahora) cache.delete(k);
  }

  cache.set(clave, {
    permitido: respuesta.permitido,
    razon: respuesta.razon,
    expiraEn: ahora + (respuesta.permitido ? TTL_OK_MS : TTL_DENY_MS),
  });

  if (!respuesta.permitido) return { ok: false, status: 403, code: "NO_ROOT" };
  return { ok: true, usuario: { username, razon: respuesta.razon } };
}

/**
 * Misma verificación desde un Server Component, donde no hay `request`: el
 * token sale de la cookie/header de la request en curso (next/headers).
 */
export async function requireRootDesdeCookies(): Promise<ResultadoRoot> {
  const { cookies, headers } = await import("next/headers");
  const [jar, hs] = await Promise.all([cookies(), headers()]);
  return requireRoot({
    headers: { get: (nombre: string) => hs.get(nombre) },
    cookies: { get: (nombre: string) => jar.get(nombre) },
  });
}
