// Motor del "probar" del portal: ejecuta UNA llamada contra la propia app, del
// lado del servidor, con la sesión del root que está mirando la pantalla.
//
// Está separado del route handler (src/app/api/docs/try/route.ts) para poder
// testear las reglas sin levantar Next: el handler arma el origen y delega acá.
//
// Reglas NO negociables (§5.3 del diseño):
//
//   · Pasa por requireRoot, igual que /api/docs/spec.
//   · SOLO contra el propio host. Nada de URL absolutas, nada de `//host`, nada
//     de `..` ni `%2e`: esto NUNCA es un proxy abierto. El path tiene que
//     empezar con /api/ y punto.
//   · GET/HEAD directo. POST/PUT/PATCH/DELETE exigen `confirmacion` igual al
//     path exacto → si no, 428 CONFIRMACION_REQUERIDA. Es root y el ambiente
//     puede ser producción: la escritura accidental se paga cara.
//   · Los headers peligrosos que mande el cliente se descartan. `authorization`
//     y `cookie` los pone el servidor con la sesión del root; que el cliente
//     pueda elegirlos convertiría esto en una máquina de firmar requests con
//     credenciales ajenas.
//   · Timeout 30 s y respuesta truncada a 1 MB (el ZIP de un lote de QRs son
//     cientos de MB: se lee con tope y se corta el stream).
//
// El pedido viaja en base64 (`{ payload }`) porque el WAF de nginx de TrackMovil
// inspecciona el body y rechaza patrones de shell: un ejemplo de curl con `$(`
// adentro no llegaría nunca. Acá se mantiene el mismo contrato que en las otras
// dos apps, aunque el WAF de Goya no sea el mismo.
import { extraerToken, requireRoot, type ResultadoRoot, type SolicitudConCredenciales } from "./root-guard";

export const TIMEOUT_TRY_MS = 30_000;
export const LIMITE_RESPUESTA_BYTES = 1024 * 1024;

const METODOS_PERMITIDOS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const METODOS_ESCRITURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Headers que el cliente NO puede mandar. `authorization`/`cookie` los pone el
 * servidor; el resto (host, x-forwarded-*, content-length…) o los pone fetch o
 * sirven para engañar al destino sobre quién llama.
 */
const HEADERS_PROHIBIDOS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "host",
  "connection",
  "keep-alive",
  "content-length",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "expect",
  "forwarded",
  "origin",
  "referer",
  "proxy-authorization",
  "proxy-connection",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
]);

const NOMBRE_HEADER = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

export interface PedidoTry {
  metodo: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  confirmacion: string;
}

export type Rechazo = { ok: false; status: number; code: string; detalle: string };
export type Aceptado = { ok: true; pedido: PedidoTry };

export interface RespuestaTry {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duracionMs: number;
  truncado: boolean;
}

function rechazo(status: number, code: string, detalle: string): Rechazo {
  return { ok: false, status, code, detalle };
}

// ── Validación ──────────────────────────────────────────────────────────────

/**
 * El path tiene que ser una ruta interna de la API de ESTA app.
 *
 * Se rechaza, en este orden y con el motivo explícito:
 *   · lo que no sea string o esté vacío
 *   · URL absoluta (`http://…`, `HTTPS://…`, `javascript:`) — cualquier
 *     `esquema:` adelante
 *   · protocol-relative (`//host/…`) y en general dos barras seguidas
 *   · traversal literal (`..`) o codificado (`%2e`, `%2E`) y `%2f` (barra
 *     codificada, que serviría para escapar del prefijo /api/ ante el destino)
 *   · caracteres de control, espacios y saltos de línea (inyección de headers)
 *   · lo que no arranque con `/api/`
 *   · el propio `/api/docs/try` (recursión)
 */
export function validarPath(valor: unknown): { ok: true; path: string } | Rechazo {
  if (typeof valor !== "string" || !valor.trim()) {
    return rechazo(400, "PATH_INVALIDO", "El path es obligatorio.");
  }
  const path = valor.trim();

  if (/[\u0000-\u001f\u007f\s]/.test(path)) {
    return rechazo(400, "PATH_INVALIDO", "El path no puede tener espacios ni caracteres de control.");
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return rechazo(400, "PATH_INVALIDO", "No se aceptan URL absolutas: sólo rutas del propio host.");
  }
  if (path.includes("//")) {
    return rechazo(400, "PATH_INVALIDO", "No se aceptan rutas con `//` (apuntarían a otro host).");
  }
  if (path.includes("..") || /%2e/i.test(path)) {
    return rechazo(400, "PATH_INVALIDO", "El path no puede contener `..` ni `%2e` (traversal).");
  }
  if (/%2f/i.test(path)) {
    return rechazo(400, "PATH_INVALIDO", "El path no puede traer barras codificadas (`%2f`).");
  }
  if (path.includes("?") || path.includes("#")) {
    return rechazo(400, "PATH_INVALIDO", "La query va en el campo `query`, no pegada al path.");
  }
  if (!path.startsWith("/api/")) {
    return rechazo(400, "PATH_INVALIDO", "El path tiene que empezar con /api/ — este endpoint no es un proxy.");
  }
  if (/^\/api\/docs\/try\/?$/.test(path)) {
    return rechazo(400, "PATH_INVALIDO", "No se puede probar el propio /api/docs/try.");
  }
  return { ok: true, path };
}

function normalizarQuery(valor: unknown): { ok: true; query: Record<string, string> } | Rechazo {
  if (valor === undefined || valor === null) return { ok: true, query: {} };
  if (typeof valor !== "object" || Array.isArray(valor)) {
    return rechazo(400, "QUERY_INVALIDA", "`query` tiene que ser un objeto { clave: valor }.");
  }
  const query: Record<string, string> = {};
  for (const [clave, bruto] of Object.entries(valor as Record<string, unknown>)) {
    if (bruto === undefined || bruto === null || bruto === "") continue;
    if (typeof bruto === "object") {
      return rechazo(400, "QUERY_INVALIDA", `El valor de \`${clave}\` tiene que ser un escalar.`);
    }
    query[clave] = String(bruto);
  }
  return { ok: true, query };
}

/** Descarta los headers prohibidos en vez de fallar: el resto de la llamada sirve igual. */
export function filtrarHeaders(valor: unknown): { headers: Record<string, string>; descartados: string[] } {
  const headers: Record<string, string> = {};
  const descartados: string[] = [];
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { headers, descartados };

  for (const [claveBruta, bruto] of Object.entries(valor as Record<string, unknown>)) {
    const clave = String(claveBruta).trim();
    const minuscula = clave.toLowerCase();
    if (!NOMBRE_HEADER.test(clave) || HEADERS_PROHIBIDOS.has(minuscula) || minuscula.startsWith("sec-")) {
      descartados.push(clave);
      continue;
    }
    if (bruto === undefined || bruto === null) continue;
    const texto = String(bruto);
    // Un \r o \n en el valor parte el request en dos (CRLF injection).
    if (/[\r\n]/.test(texto)) {
      descartados.push(clave);
      continue;
    }
    headers[clave] = texto;
  }
  return { headers, descartados };
}

function normalizarBody(valor: unknown): { ok: true; body: string | null } | Rechazo {
  if (valor === undefined || valor === null || valor === "") return { ok: true, body: null };
  if (typeof valor === "string") return { ok: true, body: valor };
  try {
    return { ok: true, body: JSON.stringify(valor) };
  } catch {
    return rechazo(400, "BODY_INVALIDO", "El cuerpo no se pudo serializar a JSON.");
  }
}

/**
 * `{ payload }` con el pedido en base64 → objeto. Acepta base64 y base64url.
 * El `confirmacion` puede venir adentro del payload (lo normal, va cifrado por
 * el base64 y no lo toca el WAF) o afuera; se toma el que esté.
 */
export function decodificarPedido(cuerpo: unknown): Aceptado | Rechazo {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    return rechazo(400, "PAYLOAD_INVALIDO", "Se esperaba un objeto { payload }.");
  }
  const { payload, confirmacion: confirmacionExterna } = cuerpo as {
    payload?: unknown;
    confirmacion?: unknown;
  };
  if (typeof payload !== "string" || !payload.trim()) {
    return rechazo(400, "PAYLOAD_INVALIDO", "Falta `payload` (base64 del pedido).");
  }

  let texto: string;
  try {
    texto = Buffer.from(payload, "base64").toString("utf8");
  } catch {
    return rechazo(400, "PAYLOAD_INVALIDO", "`payload` no es base64 válido.");
  }

  let crudo: Record<string, unknown>;
  try {
    const parseado: unknown = JSON.parse(texto);
    if (!parseado || typeof parseado !== "object" || Array.isArray(parseado)) {
      return rechazo(400, "PAYLOAD_INVALIDO", "El payload decodificado no es un objeto JSON.");
    }
    crudo = parseado as Record<string, unknown>;
  } catch {
    return rechazo(400, "PAYLOAD_INVALIDO", "El payload decodificado no es JSON válido.");
  }

  const metodo = String(crudo.metodo ?? "GET").toUpperCase();
  if (!METODOS_PERMITIDOS.has(metodo)) {
    return rechazo(400, "METODO_NO_PERMITIDO", `Método ${metodo} no permitido.`);
  }

  const path = validarPath(crudo.path);
  if (!path.ok) return path;

  const query = normalizarQuery(crudo.query);
  if (!query.ok) return query;

  const body = normalizarBody(crudo.body);
  if (!body.ok) return body;

  const { headers } = filtrarHeaders(crudo.headers);

  const confirmacion =
    typeof crudo.confirmacion === "string"
      ? crudo.confirmacion
      : typeof confirmacionExterna === "string"
        ? confirmacionExterna
        : "";

  return {
    ok: true,
    pedido: { metodo, path: path.path, query: query.query, headers, body: body.body, confirmacion },
  };
}

// ── Ejecución ───────────────────────────────────────────────────────────────

/** Lee el cuerpo con tope: corta el stream, no acumula 300 MB en RAM. */
async function leerConTope(
  respuesta: Response,
  limite: number,
): Promise<{ texto: string; truncado: boolean }> {
  if (!respuesta.body) {
    const texto = await respuesta.text();
    return texto.length > limite
      ? { texto: texto.slice(0, limite), truncado: true }
      : { texto, truncado: false };
  }

  const lector = respuesta.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  let truncado = false;

  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    if (!value) continue;
    if (total + value.length > limite) {
      trozos.push(value.subarray(0, limite - total));
      truncado = true;
      await lector.cancel().catch(() => undefined);
      break;
    }
    trozos.push(value);
    total += value.length;
  }

  const largo = trozos.reduce((acc, t) => acc + t.length, 0);
  const buffer = new Uint8Array(largo);
  let offset = 0;
  for (const trozo of trozos) {
    buffer.set(trozo, offset);
    offset += trozo.length;
  }
  return { texto: new TextDecoder().decode(buffer), truncado };
}

export interface EntradaTry {
  /** El request original, para el guard y para sacar el token del root. */
  solicitud: SolicitudConCredenciales;
  /** El cuerpo ya parseado de POST /api/docs/try. */
  cuerpo: unknown;
  /** Origen de ESTA app (https://host), derivado por el route handler. */
  origen: string;
  /** Header `Origin` del navegador, si vino: se exige mismo host (anti-CSRF). */
  origenDelNavegador?: string | null;
  fetchImpl?: typeof fetch;
  verificarRoot?: (solicitud: SolicitudConCredenciales) => Promise<ResultadoRoot>;
  ahora?: () => number;
}

export interface SalidaTry {
  status: number;
  cuerpo: Record<string, unknown>;
}

function mismoHost(a: string, b: string): boolean {
  try {
    return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Orquesta todo: guard → validación → ejecución. Devuelve el status y el cuerpo
 * que el route handler serializa tal cual.
 */
export async function manejarTry(entrada: EntradaTry): Promise<SalidaTry> {
  const verificar = entrada.verificarRoot ?? requireRoot;
  const guard = await verificar(entrada.solicitud);
  if (!guard.ok) {
    return { status: guard.status, cuerpo: { error: guard.code } };
  }

  // Anti-CSRF: si el navegador mandó Origin, tiene que ser el de esta app. Sin
  // esto, una página de otro dominio podría disparar escrituras usando la
  // cookie de sesión del root que la tenga abierta.
  const origenNavegador = entrada.origenDelNavegador;
  if (origenNavegador && !mismoHost(origenNavegador, entrada.origen)) {
    return {
      status: 403,
      cuerpo: { error: "ORIGEN_INVALIDO", detalle: "El request no viene de esta aplicación." },
    };
  }

  const decodificado = decodificarPedido(entrada.cuerpo);
  if (!decodificado.ok) {
    return {
      status: decodificado.status,
      cuerpo: { error: decodificado.code, detalle: decodificado.detalle },
    };
  }

  const { pedido } = decodificado;

  if (METODOS_ESCRITURA.has(pedido.metodo) && pedido.confirmacion !== pedido.path) {
    return {
      status: 428,
      cuerpo: {
        error: "CONFIRMACION_REQUERIDA",
        detalle:
          `Para ejecutar un ${pedido.metodo} hay que confirmar escribiendo el path exacto: ${pedido.path}`,
        path: pedido.path,
      },
    };
  }

  const token = extraerToken(entrada.solicitud);
  const headers: Record<string, string> = { Accept: "*/*", ...pedido.headers };
  if (token) {
    // La sesión la pone el servidor, nunca el cliente.
    headers.Authorization = `Bearer ${token}`;
    headers.Cookie = `token=${token}`;
  }
  if (pedido.body !== null && !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  const query = new URLSearchParams(pedido.query).toString();
  const url = `${entrada.origen}${pedido.path}${query ? `?${query}` : ""}`;

  const ejecutar = entrada.fetchImpl ?? fetch;
  const reloj = entrada.ahora ?? (() => Date.now());
  const arranque = reloj();

  try {
    const respuesta = await ejecutar(url, {
      method: pedido.metodo,
      headers,
      body: pedido.metodo === "GET" || pedido.metodo === "HEAD" ? undefined : (pedido.body ?? undefined),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_TRY_MS),
    });

    const { texto, truncado } = await leerConTope(respuesta, LIMITE_RESPUESTA_BYTES);

    const headersRespuesta: Record<string, string> = {};
    respuesta.headers.forEach((valor, clave) => {
      // set-cookie no se devuelve: no tiene valor documental y puede traer sesión.
      if (clave.toLowerCase() !== "set-cookie") headersRespuesta[clave] = valor;
    });

    const resultado: RespuestaTry = {
      status: respuesta.status,
      statusText: respuesta.statusText,
      headers: headersRespuesta,
      body: texto,
      duracionMs: reloj() - arranque,
      truncado,
    };
    return { status: 200, cuerpo: resultado as unknown as Record<string, unknown> };
  } catch (err) {
    const mensaje = (err as Error)?.message ?? "error desconocido";
    const esTimeout = (err as Error)?.name === "TimeoutError" || /timeout|abort/i.test(mensaje);
    return {
      status: esTimeout ? 504 : 502,
      cuerpo: {
        error: esTimeout ? "TIMEOUT" : "ERROR_DE_RED",
        detalle: esTimeout ? `La llamada superó los ${TIMEOUT_TRY_MS / 1000} s.` : mensaje,
        duracionMs: reloj() - arranque,
      },
    };
  }
}
