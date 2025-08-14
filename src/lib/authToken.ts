export function setAuthToken(token: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
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
    }
  } catch {
    // noop
  }
}
