// Contrato del formulario público de sorteos (rutas sin sesión).
// El front NO importa nada de `backend/` (proyectos y tsconfig separados):
// el regex de código está duplicado a propósito contra
// `backend/src/sorteos/sorteos.util.ts`.
export const CODIGO_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;

export const COOKIE_CODIGO = "sorteo_codigo";
export const COOKIE_DEVICE = "sorteo_device";
export const COOKIE_T0 = "sorteo_t0";

export const MAX_AGE_CODIGO = 7200; // 2 h: lo que dura la sesión del formulario
export const MAX_AGE_DEVICE = 31536000; // 1 año: identifica al dispositivo entre sorteos
export const MAX_AGE_T0 = 7200;

// Ventana mínima entre que se sirve el formulario y el submit. Por debajo se
// asume bot: nadie completa nombre + teléfono + edad en menos de 3 segundos.
export const MIN_SUBMIT_MS = 3000;

export const ESTADO_TIMEOUT_MS = 8000;
export const PARTICIPAR_TIMEOUT_MS = 15000;

export type SorteoPublico = {
  nombre: string;
  premioDescripcion: string;
  edadMinima: number;
};

// 'sin_cookie' y 'error_temporal' los agrega el front (el Nest no los devuelve).
export type EstadoPublico =
  | "ok"
  | "usado"
  | "no_iniciado"
  | "finalizado"
  | "invalido"
  | "sin_cookie"
  | "error_temporal";

export type EstadoResponse = {
  estado: EstadoPublico;
  sorteo?: SorteoPublico;
};

// 'error_temporal' lo agrega el front cuando el Nest no responde.
export type ResultadoParticipacion =
  | "ganador"
  | "sigue"
  | "usado"
  | "invalido"
  | "no_iniciado"
  | "finalizado"
  | "limite_dispositivo"
  | "edad_invalida"
  | "error_temporal";

export type ParticiparResponse = {
  resultado: ResultadoParticipacion;
  codigoCanje?: string;
};

/** Base del backend NestJS, misma env que el proxy catch-all (`src/app/api/[...path]/route.ts`). */
export function nestBase(): string {
  return (
    process.env.NEXT_PUBLIC_NESTJS_API_URL || "http://localhost:3001"
  ).replace(/\/$/, "");
}

/** Prefijo global del NestJS. */
export const NEST_PREFIX = "/api";

export function nestUrl(path: string): string {
  return `${nestBase()}${NEST_PREFIX}${path}`;
}

/** API key del formulario público (`SorteosApiKeyGuard` del backend). */
export function apiKey(): string {
  return process.env.SORTEOS_PUBLIC_API_KEY || "";
}

/** Largo de `sorteo_participacion.ip` (VarChar(45)): más que eso rompe el insert. */
const IP_MAX = 45;

function ipPlausible(valor: string): boolean {
  return valor.length > 0 && valor.length <= IP_MAX && /^[0-9a-fA-F.:]+$/.test(valor);
}

/**
 * IP del cliente para mandarle al backend.
 *
 * El `x-forwarded-for` que llega del navegador es texto libre elegido por quien
 * hace la request, y el backend lee la entrada de MÁS a la izquierda: reenviarlo
 * tal cual es dejar que cualquiera escriba la IP que queda auditada y
 * geolocalizada. Se usa entonces la ÚLTIMA entrada de la cadena, que es la que
 * agrega el reverse proxy (`$proxy_add_x_forwarded_for` appendea a la derecha) y
 * el cliente no controla. Sin cadena confiable se manda vacío: preferimos no
 * registrar IP antes que registrar una inventada.
 */
export function ipDelCliente(headers: Headers): string {
  const cadena = (headers.get("x-forwarded-for") ?? "").split(",");
  const ultima = (cadena[cadena.length - 1] ?? "").trim();
  return ipPlausible(ultima) ? ultima : "";
}

type CookieOpts = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

export function cookieOpts(maxAge: number): CookieOpts {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}
