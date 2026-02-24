import axios from "axios";
import { getAuthToken } from "./authToken";
import { setGlobalLoading } from "./LoadingContext";

// Helper: pending requests counter to avoid flicker
let pendingRequests = 0;
function shouldUseGlobalLoading(config: any) {
  // Allow opting-out per request with a custom flag
  return !(config && (config as any).disableGlobalLoading === true);
}
function messageFor(config: any) {
  const url: string = (config?.url ?? "").toString();
  if (url.includes("/login")) return "Iniciando sesión...";
  if (url.includes("/menuApp")) return "Cargando menú...";
  if (url.includes("/Importar") || url.includes("/importar")) return "Importando datos...";
  if (url.includes("/get")) return "Cargando datos...";
  return "Procesando...";
}
function startGlobal(config: any) {
  if (!shouldUseGlobalLoading(config)) return;
  pendingRequests += 1;
  if (pendingRequests === 1) {
    setGlobalLoading(true, messageFor(config));
  }
}
function stopGlobal(config: any) {
  if (!shouldUseGlobalLoading(config)) return;
  pendingRequests = Math.max(0, pendingRequests - 1);
  if (pendingRequests === 0) {
    setGlobalLoading(false);
  }
}

// ============================================
// BACKEND MODE: 'legacy' (GeneXus) o 'nestjs'
// ============================================
export const API_BACKEND_MODE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BACKEND
    : process.env.NEXT_PUBLIC_API_BACKEND) || "legacy";

export const isNestjsBackend = API_BACKEND_MODE === "nestjs";

// Instancia principal — siempre apunta al proxy /api que redirige según NEXT_PUBLIC_API_BACKEND
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Adjuntar token automáticamente si existe
api.interceptors.request.use((config) => {
  try {
    const token = getAuthToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {
    // noop
  }
  // Start global loading
  startGlobal(config as any);
  return config;
}, (error) => {
  // If the request itself fails before being sent
  stopGlobal(error?.config);
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  stopGlobal(response.config);
  return response;
}, (error) => {
  stopGlobal(error?.config);
  return Promise.reject(error);
});

// Instancia para Overpass
const overpassApi = axios.create({
  baseURL: "https://overpass-api.de/api/interpreter",
  headers: {
    "Content-Type": "text/plain",
  },
  withCredentials: false, // ⬅️ Overpass no permite credenciales
});

// Optionally also show loading for Overpass requests
overpassApi.interceptors.request.use((config) => {
  startGlobal(config as any);
  return config;
}, (error) => {
  stopGlobal(error?.config);
  return Promise.reject(error);
});

overpassApi.interceptors.response.use((response) => {
  stopGlobal(response.config);
  return response;
}, (error) => {
  stopGlobal(error?.config);
  return Promise.reject(error);
});

export { api, overpassApi };
