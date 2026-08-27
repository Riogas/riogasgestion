// Verificación del estado de la sesión contra SecuritySuite (secapi).
// SOLO servidor: usa SECAPI_URL, que no es una var NEXT_PUBLIC_*.
//
// Por qué hace falta preguntar: desde que secapi verifica la firma del JWT, un
// token puede estar "vigente" según su propio `exp` y aun así ser rechazado
// (fue firmado con otro secreto). Decodificar el token acá no alcanza para
// saberlo — hay que dejar que secapi lo mire.

import { codigoGuardSecapi } from "@/lib/secapiGuard";

const SECAPI_URL = (
  process.env.SECAPI_URL || "https://secapi-dev.glp.riogas.com.uy"
).replace(/\/$/, "");

// goya = 3; mismo fallback que los route handlers
const APP_ID = (() => {
  const n = Number(process.env.NEXT_PUBLIC_APLICACION_ID ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

// Sonda de diagnóstico, no un gate: si tarda, la pantalla igual se muestra
// (DESCONOCIDO es un fallback seguro). Por eso el timeout es corto — bloquea el
// render de /no-autorizado, que es adonde cae toda navegación denegada, y no
// vale la pena hacer esperar 4s para terminar mostrando la misma pantalla.
const TIMEOUT_MS = 1500;

export type EstadoSesion =
  /** secapi aceptó el token. */
  | "VIVA"
  /** 401 SIN_TOKEN / TOKEN_INVALIDO / TOKEN_VENCIDO: hay que volver a entrar. */
  | "VENCIDA"
  /** 401 USUARIO_NO_ENCONTRADO: el usuario no está activo. Volver a entrar NO sirve. */
  | "USUARIO_INACTIVO"
  /** 503 SECRETO_NO_CONFIGURADO: a secapi le falta el secreto de firma. */
  | "NO_CONFIGURADO"
  /** secapi no contestó, o contestó algo que no habla de la sesión (403, ERROR_GUARD). */
  | "DESCONOCIDO";

/**
 * Pregunta a secapi si el token sigue siendo válido.
 *
 * Sonda: GET /api/db/menu. Es idempotente, no escribe nada y responde 401 con
 * token muerto, que es exactamente lo que queremos distinguir.
 */
export async function verificarSesionSecapi(token?: string): Promise<EstadoSesion> {
  if (!token) return "VENCIDA";

  try {
    const res = await fetch(`${SECAPI_URL}/api/db/menu?aplicacionId=${APP_ID}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.ok) return "VIVA";

    // El motivo va en el header `x-auth-guard`, no en el body: el body de una
    // denegación trae prosa ("Tu sesión no es válida, volvé a iniciar sesión"),
    // igual para un token vencido que para un usuario dado de baja.
    const codigo = codigoGuardSecapi(res.headers);

    if (res.status === 401) {
      // Distinguirlo importa porque la salida es la contraria: VENCIDA se
      // arregla volviendo a entrar y USUARIO_INACTIVO no (el login de secapi
      // sólo rechaza el estado 'I').
      return codigo === "USUARIO_NO_ENCONTRADO" ? "USUARIO_INACTIVO" : "VENCIDA";
    }

    // Sólo SECRETO_NO_CONFIGURADO es el 503 permanente. El otro 503 posible,
    // ERROR_GUARD, es transitorio (p.ej. Postgres no contesta) y anunciarlo como
    // "falta el secreto" manda a Sistemas a buscar un problema que no existe.
    if (res.status === 503 && codigo === "SECRETO_NO_CONFIGURADO") {
      return "NO_CONFIGURADO";
    }

    // Cualquier otra cosa (403, ERROR_GUARD, 5xx genérico): secapi habló pero no
    // de la sesión. No es asunto de esta función.
    return "DESCONOCIDO";
  } catch {
    return "DESCONOCIDO";
  }
}
