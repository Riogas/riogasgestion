export function setAuthToken(token: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
      // También guardar en cookie para el middleware (sin flags problemáticos)
      document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 30}`;
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
