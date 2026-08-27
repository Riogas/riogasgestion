// Estado de la sesión frente a SecuritySuite (secapi).
//
// secapi exige JWT con firma verificada en /api/db/*, así que un 401 suyo
// significa siempre lo mismo: el token que tenemos guardado ya no sirve (firma
// vieja, vencido, o el usuario no existe). Eso NO es "falta de permiso" ni
// "error de red": es sesión muerta, y la única salida es volver a /login.
//
// Este módulo centraliza las dos cosas que necesitan todas las capas del front
// para tratarlo igual: cómo marcar el error y a dónde mandar al usuario.

// Destino único para "te sacamos porque tu sesión murió". El `?sesion=expirada`
// lo lee /login para barrer las credenciales viejas (si queda el token muerto
// en localStorage, axios lo sigue mandando) y explicar por qué lo sacaron.
export const RUTA_LOGIN_SESION_EXPIRADA = "/login?sesion=expirada";

/** Error de sesión rechazada por secapi (HTTP 401). */
export class SesionVencidaError extends Error {
  readonly status = 401;
  readonly sesionVencida = true;

  constructor(message = "La sesión venció. Volvé a iniciar sesión.") {
    super(message);
    this.name = "SesionVencidaError";
  }
}

/**
 * ¿Este error es una sesión muerta? Contempla tanto el error propio como
 * cualquier error de axios/fetch con status 401, porque no todas las llamadas
 * pasan por la misma capa.
 */
export function esSesionVencida(error: unknown): boolean {
  if (error instanceof UsuarioNoActivoError) return false;
  if (error instanceof SesionVencidaError) return true;
  const e = error as { sesionVencida?: boolean; status?: number; response?: { status?: number } };
  return e?.sesionVencida === true || e?.status === 401 || e?.response?.status === 401;
}

// ── Usuario dado de baja ────────────────────────────────────────────────────
//
// secapi responde 401 USUARIO_NO_ENCONTRADO cuando el token está perfecto pero
// el usuario no figura con estado 'A'. Parece una sesión vencida y no lo es: su
// login sólo rechaza el estado 'I', así que el usuario vuelve a entrar sin
// problema y come 401 en la próxima llamada. Mandarlo a /login es un loop
// infinito con un cartel falso ("tu sesión venció"), así que necesita su propio
// error, su propio destino y un código para reportar.
//
// Los route handlers lo devuelven como 403 { error: "USUARIO_NO_ACTIVO" } a
// propósito: si saliera 401, cualquier capa que trate los 401 como sesión
// vencida lo volvería a mandar a /login.
export const RUTA_USUARIO_NO_ACTIVO = "/no-autorizado";

/** Error de usuario inactivo en SecuritySuite (HTTP 403 USUARIO_NO_ACTIVO). */
export class UsuarioNoActivoError extends Error {
  readonly status = 403;
  readonly usuarioNoActivo = true;

  constructor(
    message = "Tu usuario no está activo en SecuritySuite. Avisá a Sistemas (USUARIO_NO_ENCONTRADO).",
  ) {
    super(message);
    this.name = "UsuarioNoActivoError";
  }
}

/** ¿Este error es "el usuario no está activo"? */
export function esUsuarioNoActivo(error: unknown): boolean {
  if (error instanceof UsuarioNoActivoError) return true;
  const e = error as {
    usuarioNoActivo?: boolean;
    response?: { data?: { error?: string } };
  };
  return (
    e?.usuarioNoActivo === true || e?.response?.data?.error === "USUARIO_NO_ACTIVO"
  );
}
