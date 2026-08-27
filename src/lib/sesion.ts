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
  if (error instanceof SesionVencidaError) return true;
  const e = error as { sesionVencida?: boolean; status?: number; response?: { status?: number } };
  return e?.sesionVencida === true || e?.status === 401 || e?.response?.status === 401;
}
