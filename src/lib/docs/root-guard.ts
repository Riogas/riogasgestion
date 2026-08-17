// Gate root del portal de documentación (/dashboard/docs y /api/docs/*).
//
// El JWT de secapi NO lleva el flag root en el payload ({iss, username, userId,
// sistema}): decidir "es root" leyendo el token es imposible, hay que
// preguntarle a secapi en cada request. Se consulta el mismo endpoint que ya
// usa el gate de páginas en src/proxy.ts (POST {SECAPI_URL}/api/db/permisos)
// con el mismo shape de body y el token en Authorization.
//
// Diferencia deliberada con src/proxy.ts: ACÁ EL FALLO ES CERRADO. El proxy,
// si secapi no responde, sirve el último valor cacheado aunque esté vencido
// para no trabar la operativa del dashboard. Este portal lista qué endpoints
// están sin autenticación: si no se puede verificar que quien entra es root,
// no se abre.
//
// Contrato:  requireRoot(request) → { ok: true, usuario } | { ok: false, status, code }
import type { NextRequest } from "next/server";

const SECAPI_URL = (
  process.env.SECAPI_URL || "https://secapi-dev.glp.riogas.com.uy"
).replace(/\/$/, "");

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
  /** username del JWT (sin verificar firma: secapi es quien valida). */
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

// ── Caché en memoria ────────────────────────────────────────────────────────
// Igual que en src/proxy.ts: la key es un hash corto del token (no se retienen
// JWTs completos) y el TTL evita pegarle a secapi en cada request de la página.
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

function extraerToken(request: SolicitudConCredenciales): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return request.cookies?.get("token")?.value ?? null;
}

/** Payload del JWT sin verificar firma (igual que decodeJwtPayload de proxy.ts). */
function decodificarJwt(token: string): Record<string, unknown> | null {
  try {
    const partes = token.split(".");
    if (partes.length < 2) return null;
    const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function usernameDelToken(token: string): string {
  const payload = decodificarJwt(token);
  if (!payload) return "";
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
): Promise<{ permitido: boolean; razon: string } | null> {
  try {
    // Mismo contrato que src/proxy.ts:
    //   body → { AplicacionId, permisos: [{ ObjetoKey, AccionKey }] }
    //   resp → { resultados: [{ accionKey, permitido: 'GRANTED'|'DENIED', razon }] }
    // secapi acepta tanto `aplicacion` (nombre) como `AplicacionId` (número);
    // acá se usa el id porque el alta del objeto docs se hizo por id de app.
    const resp = await fetch(`${SECAPI_URL}/api/db/permisos`, {
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

    // 401/403 son respuestas legítimas de secapi (token inválido, usuario
    // inexistente): deniegan. 5xx es "no pude verificar" → fail-closed.
    if (resp.status >= 500) return null;

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
 * Verifica contra secapi que el usuario del request tenga docs:view en GOYA.
 *
 * Códigos devueltos:
 *   401 NO_TOKEN            → no vino JWT ni por header ni por cookie
 *   403 NO_ROOT             → secapi contestó DENIED
 *   503 SECAPI_INACCESIBLE  → secapi caído/timeout: no se puede verificar → se deniega
 */
export async function requireRoot(
  request: SolicitudConCredenciales | NextRequest,
): Promise<ResultadoRoot> {
  const token = extraerToken(request as SolicitudConCredenciales);
  if (!token) return { ok: false, status: 401, code: "NO_TOKEN" };

  const clave = await claveCache(token);
  const ahora = Date.now();
  const cacheado = cache.get(clave);

  if (cacheado && cacheado.expiraEn > ahora) {
    return cacheado.permitido
      ? { ok: true, usuario: { username: usernameDelToken(token), razon: cacheado.razon } }
      : { ok: false, status: 403, code: "NO_ROOT" };
  }

  const respuesta = await consultarSecapi(token);

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
  return {
    ok: true,
    usuario: { username: usernameDelToken(token), razon: respuesta.razon },
  };
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
