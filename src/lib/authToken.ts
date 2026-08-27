// Vida de la cookie `token`. Tiene que ser la MISMA que el `exp` del JWT que
// firma secapi (7 días): antes la cookie duraba 30, así que sobrevivía al token
// tres semanas. En esa ventana el middleware veía "hay sesión" y dejaba pasar,
// pero secapi ya rechazaba el token → el usuario terminaba en /no-autorizado
// con la cookie viva y refrescar no lo sacaba de ahí. Con los dos plazos
// iguales, la sesión muerta se cae sola y el flujo natural es volver a /login.
// Si secapi cambia el `exp` de sus tokens, hay que cambiar esta constante.
export const AUTH_COOKIE_MAX_AGE_SEG = 60 * 60 * 24 * 7; // 7 días

export function setAuthToken(token: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
      // También guardar en cookie para el middleware (sin flags problemáticos)
      document.cookie = `token=${token}; path=/; max-age=${AUTH_COOKIE_MAX_AGE_SEG}`;
    }
  } catch {
    // noop
  }
}

export function getAuthToken(): string | null {
  try {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token");
    }
  } catch {
    // noop
  }
  return null;
}

export function clearAuthToken() {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      // También limpiar la cookie
      document.cookie = "token=; path=/; max-age=0";
    }
  } catch {
    // noop
  }
}
