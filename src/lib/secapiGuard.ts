// Lectura del veredicto del guard de SecuritySuite (secapi) para /api/db/*.
//
// POR QUÉ EXISTE ESTE MÓDULO: secapi NUNCA manda el código de error en el body.
// `denegar()` (security_suite/src/lib/auth/apiGuard.ts) arma la respuesta así:
//
//     NextResponse.json(
//       { success: false, error: mensajeDe(code) },      // ← prosa para humanos
//       { status, headers: { "x-auth-guard": code } },   // ← el código va acá
//     )
//
// con el comentario "NUNCA se devuelve el `code` en el body: son nombres
// internos". O sea que comparar `json.error === "SECRETO_NO_CONFIGURADO"` es
// código muerto para todo lo que pase por el guard: el body real dice "El
// servidor no está configurado para autorizar esta operación; avisá a sistemas".
//
// ÚNICA EXCEPCIÓN: POST /api/db/login es de nivel PUBLICA, no pasa por
// `denegar()`, y su 503 sí trae { error: "SECRETO_NO_CONFIGURADO" } en el body
// (security_suite/src/lib/auth/responses.ts). Por eso acá el body se acepta como
// fallback: no puede dar falsos positivos, porque ninguno de los mensajes
// humanos del guard coincide con un nombre de código.
//
// Sin dependencias a propósito: esto también se usa desde src/proxy.ts, que
// corre en el runtime Edge.

/** Códigos que emite el guard de secapi (`CodigoApiAuth` en apiGuard.ts). */
export type CodigoGuardSecapi =
  | "SIN_TOKEN" // 401 — no vino ni Authorization ni cookie `token`
  | "TOKEN_INVALIDO" // 401 — firma que no cierra o token malformado
  | "TOKEN_VENCIDO" // 401 — firma válida, `exp` pasado
  | "USUARIO_NO_ENCONTRADO" // 401 — el token nombra a alguien que no está activo
  | "NO_ROOT" // 403 — sesión válida sin es_root='S'
  | "SIN_POLITICA" // 403 — ruta/método sin política declarada
  | "SERVICIO_FUERA_DE_ALCANCE" // 403 — api-key en un endpoint que no le toca
  | "SECRETO_NO_CONFIGURADO" // 503 — falta (o es inválido) JWT_SECRET
  | "ERROR_GUARD"; // 503 — el guard no pudo decidir (p.ej. Postgres caído)

const CODIGOS: readonly string[] = [
  "SIN_TOKEN",
  "TOKEN_INVALIDO",
  "TOKEN_VENCIDO",
  "USUARIO_NO_ENCONTRADO",
  "NO_ROOT",
  "SIN_POLITICA",
  "SERVICIO_FUERA_DE_ALCANCE",
  "SECRETO_NO_CONFIGURADO",
  "ERROR_GUARD",
];

function esCodigo(valor: unknown): valor is CodigoGuardSecapi {
  return typeof valor === "string" && CODIGOS.includes(valor);
}

/**
 * Devuelve el código del guard de una respuesta de secapi, o null si no lo trae.
 *
 * Fuente principal: el header `x-auth-guard`. El `body` es sólo el fallback para
 * /api/db/login (ver arriba) y para cualquier respuesta que no venga del guard;
 * si el body trae prosa —que es lo normal— no matchea nada y se devuelve null.
 */
export function codigoGuardSecapi(
  headers: Headers | null | undefined,
  body?: unknown,
): CodigoGuardSecapi | null {
  const delHeader = headers?.get("x-auth-guard")?.trim();
  if (esCodigo(delHeader)) return delHeader;

  const delBody = (body as { error?: unknown } | null | undefined)?.error;
  if (esCodigo(delBody)) return delBody;

  return null;
}

/**
 * ¿Este 503 es "a secapi le falta JWT_SECRET"?
 *
 * Importa distinguirlo del otro 503 posible (ERROR_GUARD): éste es PERMANENTE
 * —reintentar no sirve, volver a loguearse tampoco— mientras que ERROR_GUARD es
 * transitorio y sí se arregla solo. Tratarlos igual da un mensaje falso en
 * cualquiera de las dos direcciones.
 */
export function esSecretoNoConfigurado(
  headers: Headers | null | undefined,
  body?: unknown,
): boolean {
  return codigoGuardSecapi(headers, body) === "SECRETO_NO_CONFIGURADO";
}

/**
 * ¿Este 401 es "el usuario del token no está activo en SecuritySuite"?
 *
 * secapi devuelve USUARIO_NO_ENCONTRADO cuando `resolveUsuario` no encuentra la
 * fila con estado 'A', pero su login sólo rechaza el estado 'I': un usuario en
 * cualquier otro estado loguea bien y después come 401 para siempre. Mandarlo a
 * /login es un loop sin salida — por eso necesita su propio camino.
 */
export function esUsuarioNoActivoSecapi(
  headers: Headers | null | undefined,
  body?: unknown,
): boolean {
  return codigoGuardSecapi(headers, body) === "USUARIO_NO_ENCONTRADO";
}
