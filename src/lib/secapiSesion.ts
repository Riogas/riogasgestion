// Verificación del estado de la sesión contra SecuritySuite (secapi).
// SOLO servidor: usa SECAPI_URL, que no es una var NEXT_PUBLIC_*.
//
// Por qué hace falta preguntar: desde que secapi verifica la firma del JWT, un
// token puede estar "vigente" según su propio `exp` y aun así ser rechazado
// (fue firmado con otro secreto). Decodificar el token acá no alcanza para
// saberlo — hay que dejar que secapi lo mire.

const SECAPI_URL = (
  process.env.SECAPI_URL || "https://secapi-dev.glp.riogas.com.uy"
).replace(/\/$/, "");

// goya = 3; mismo fallback que los route handlers
const APP_ID = (() => {
  const n = Number(process.env.NEXT_PUBLIC_APLICACION_ID ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

const TIMEOUT_MS = 4000;

export type EstadoSesion =
  /** secapi aceptó el token. */
  | "VIVA"
  /** 401: token rechazado (firma vieja, vencido, usuario inexistente). */
  | "VENCIDA"
  /** 503 SECRETO_NO_CONFIGURADO: a secapi le falta el secreto de firma. */
  | "NO_CONFIGURADO"
  /** secapi no contestó (timeout/red/5xx). No sabemos nada: no asumir nada. */
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

    if (res.status === 401) return "VENCIDA";
    if (res.ok) return "VIVA";

    if (res.status === 503) {
      const data = await res.json().catch(() => ({}));
      if ((data as { error?: string })?.error === "SECRETO_NO_CONFIGURADO") {
        return "NO_CONFIGURADO";
      }
    }

    // Cualquier otra cosa (403, 5xx genérico): secapi habló pero no de la
    // sesión. No es asunto de esta función.
    return "DESCONOCIDO";
  } catch {
    return "DESCONOCIDO";
  }
}
