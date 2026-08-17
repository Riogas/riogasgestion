// Modelo de vista del portal /dashboard/docs.
//
// Toma el documento OpenAPI ya mergeado (docs/api/openapi.json +
// docs/api/anotaciones.yaml, ver spec.ts) y lo aplana en algo que el visor
// pueda dibujar sin volver a razonar sobre $ref, mapped types ni extensiones
// x-goya-*. Es una función PURA sobre el documento: no toca disco ni red, así
// que se testea sola y corre igual en el Server Component que en un test.
//
// Tres cosas que el visor necesita y el OpenAPI crudo no da:
//
//   1. La CATEGORÍA de autenticación, no el texto libre. "x-api-key
//      (CallesApiKeyGuard)", "x-api-key" y "x-api-key (SyncApiKeyGuard)" son el
//      mismo hecho para quien mira la pantalla; lo que cambia es la key.
//   2. Los ERRORES DEL GUARD. Ningún endpoint declara sus 401: los tira el
//      guard, iguales para todos los que usan ese guard. Se derivan de la
//      categoría (los textos salen de los guards reales del backend).
//   3. El ESQUELETO del cuerpo, para precargar el formulario del "probar".
import type { CatalogoDocs } from "./spec";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

// ── Autenticación ───────────────────────────────────────────────────────────

/**
 * Categorías de autenticación. El orden acá es el orden en que se muestran en
 * el panel "Estado de la autenticación", de más preocupante a menos.
 */
export const CATEGORIAS_AUTH = [
  "ninguna",
  "publica",
  "delegada",
  "sesion",
  "api-key",
  "jwt",
  "root",
  "otra",
] as const;

export type CategoriaAuth = (typeof CATEGORIAS_AUTH)[number];

export const ETIQUETA_CATEGORIA: Record<CategoriaAuth, string> = {
  ninguna: "SIN AUTH",
  publica: "PÚBLICO",
  delegada: "DELEGADA",
  sesion: "TOKEN DE SESIÓN",
  "api-key": "x-api-key",
  jwt: "JWT",
  root: "SOLO ROOT",
  otra: "OTRA",
};

export const DESCRIPCION_CATEGORIA: Record<CategoriaAuth, string> = {
  ninguna:
    "No valida nada. Cualquiera que llegue a la URL entra. Si no es un endpoint público a propósito, es un agujero.",
  publica:
    "Sin autenticación A PROPÓSITO: es un endpoint público (login, health, formulario del QR). Igual conviene revisar qué devuelve.",
  delegada:
    "Este handler no valida: reenvía al destino y ahí se valida. Si el destino tampoco valida, el endpoint queda abierto.",
  sesion: "Token de sesión propio del módulo, con alcance acotado (no es el JWT del panel).",
  "api-key": "Header x-api-key comparado con timingSafeEqual contra una variable del .env del server.",
  jwt: "Bearer JWT emitido por SecuritySuite. NO distingue rol: cualquier usuario logueado de cualquier app entra.",
  root: "JWT verificado (firma + exp) más el permiso docs:view consultado contra SecuritySuite en cada request.",
  otra: "Autenticación propia que no encaja en las categorías anteriores. Ver las notas del endpoint.",
};

/**
 * Clasifica el texto libre de autenticación en una categoría.
 *
 * El orden de los tests importa: "JWT + permiso docs:view" tiene que caer en
 * `root` y no en `jwt`, y "ninguna del lado del navegador" en `publica` sólo si
 * la anotación lo declaró así (por eso existe el override `categoria`).
 */
export function clasificarAuth(texto: string, override?: string): CategoriaAuth {
  const declarada = (override ?? "").trim().toLowerCase();
  if ((CATEGORIAS_AUTH as readonly string[]).includes(declarada)) {
    return declarada as CategoriaAuth;
  }

  const t = (texto ?? "").toLowerCase();
  if (!t.trim()) return "otra";
  if (/docs:view|solo root|permiso docs/.test(t)) return "root";
  if (/x-api-key|api key|apikey/.test(t)) return "api-key";
  if (/sesi[oó]n|sesionmostrador|token de sesi/.test(t)) return "sesion";
  if (/jwt|bearer|cookie token/.test(t)) return "jwt";
  if (/ninguna|sin guard|sin auth|p[uú]blic/.test(t)) return "ninguna";
  return "otra";
}

/** Las categorías que un root quiere ver primero: nadie valida en esta capa. */
export function esSinValidacion(categoria: CategoriaAuth): boolean {
  return categoria === "ninguna" || categoria === "publica" || categoria === "delegada";
}

/**
 * Errores que tira el GUARD, no el handler. Los textos son los de los guards
 * reales (backend/src/common/guards/auth.guard.ts y los *ApiKeyGuard de cada
 * módulo): ninguna operación los declara en el OpenAPI porque se disparan antes
 * de entrar al controller.
 */
export function erroresDelGuard(categoria: CategoriaAuth): ErrorVista[] {
  switch (categoria) {
    case "jwt":
      return [
        { codigo: "401", cuando: "No vino el header Authorization o no arranca con 'Bearer '", cuerpo: "Token ausente" },
        { codigo: "401", cuando: "Con JWT_SECRET configurada, la firma HMAC-SHA256 no cierra", cuerpo: "Firma inválida" },
        { codigo: "401", cuando: "El payload no es un JSON válido", cuerpo: "Token inválido" },
        { codigo: "401", cuando: "El `exp` del token ya pasó", cuerpo: "Token expirado" },
      ];
    case "api-key":
      return [
        { codigo: "401", cuando: "La variable de entorno con la key no está seteada en el server", cuerpo: "<KEY> no configurada" },
        { codigo: "401", cuando: "No vino el header x-api-key", cuerpo: "Falta header x-api-key" },
        { codigo: "401", cuando: "La key no coincide (comparación timingSafeEqual)", cuerpo: "x-api-key inválida" },
      ];
    case "sesion":
      return [
        { codigo: "401", cuando: "No vino el Bearer con el token de sesión", cuerpo: "Falta el token de la sesión de mostrador" },
        {
          codigo: "401",
          cuando: "El token venció, no existe, o es de OTRO cliente que el de la URL",
          cuerpo: "La sesión venció o no corresponde a este cliente: volvé a abrir la ficha",
        },
      ];
    case "root":
      return [
        { codigo: "401", cuando: "Sin token, firma inválida o token vencido", cuerpo: '{ "error": "NO_TOKEN" | "TOKEN_INVALIDO" | "TOKEN_VENCIDO" }' },
        { codigo: "403", cuando: "SecuritySuite contestó DENIED para docs:view", cuerpo: '{ "error": "NO_ROOT" }' },
        {
          codigo: "503",
          cuando: "Falta JWT_SECRET o SECAPI_URL en el server, o SecuritySuite no contestó (fail-closed)",
          cuerpo: '{ "error": "SECRETO_NO_CONFIGURADO" | "SECAPI_URL_NO_CONFIGURADA" | "SECAPI_INACCESIBLE" }',
        },
      ];
    default:
      return [];
  }
}

// ── Tipos de la vista ───────────────────────────────────────────────────────

export interface ParametroVista {
  nombre: string;
  ubicacion: "path" | "query" | "header";
  requerido: boolean;
  tipo: string;
  descripcion: string;
  opciones: string[];
  restricciones: string;
}

export interface CampoCuerpo {
  nombre: string;
  tipo: string;
  requerido: boolean;
  descripcion: string;
  opciones: string[];
  restricciones: string;
}

export interface CuerpoVista {
  requerido: boolean;
  contentType: string;
  schemaNombre: string;
  descripcion: string;
  campos: CampoCuerpo[];
  /** JSON de ejemplo derivado del schema, para precargar el formulario. */
  esqueleto: string;
}

export interface RespuestaVista {
  codigo: string;
  descripcion: string;
  ejemplo: string;
}

export interface ErrorVista {
  codigo: string;
  cuando: string;
  cuerpo: string;
}

export interface EjemploVista {
  titulo: string;
  lenguaje: string;
  codigo: string;
}

export interface EndpointVista {
  id: string;
  metodo: string;
  ruta: string;
  modulo: string;
  resumen: string;
  descripcion: string;
  auth: string;
  categoriaAuth: CategoriaAuth;
  consumidores: string[];
  notas: string;
  origen: string;
  archivo: string;
  anotado: boolean;
  esEscritura: boolean;
  parametros: ParametroVista[];
  cuerpo: CuerpoVista | null;
  respuestas: RespuestaVista[];
  errores: ErrorVista[];
  ejemplos: EjemploVista[];
  /** Todo el texto buscable, ya en minúsculas y sin acentos. */
  busqueda: string;
}

export interface AdvertenciaVista {
  titulo: string;
  severidad: string;
  detalle: string;
  afecta: string;
}

export interface ResumenAuth {
  total: number;
  porCategoria: Array<{ categoria: CategoriaAuth; cantidad: number; endpoints: string[] }>;
  /** Los que no validan nada en esta capa: `ninguna` + `publica` + `delegada`. */
  sinValidacion: EndpointVista[];
  advertencias: AdvertenciaVista[];
}

export interface VistaDocs {
  titulo: string;
  version: string;
  endpoints: EndpointVista[];
  modulos: Array<{ nombre: string; cantidad: number; sinAuth: number }>;
  resumen: ResumenAuth;
  huerfanas: string[];
  anotados: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const METODOS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
const ESCRITURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Ancla estable para el deep-link de cada endpoint. */
export function idEndpoint(metodo: string, ruta: string): string {
  return `${metodo}-${ruta}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Sin acentos y en minúsculas: buscar "geolocalizacion" tiene que encontrar "geolocalización". */
export function normalizar(texto: string): string {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolverRef(nodo: Json | undefined, schemas: Json): Json {
  if (!nodo) return {};
  const ref = typeof nodo.$ref === "string" ? nodo.$ref : "";
  if (!ref.startsWith("#/components/schemas/")) return nodo;
  const nombre = ref.slice("#/components/schemas/".length);
  return schemas[nombre] ?? {};
}

function nombreDeRef(nodo: Json | undefined): string {
  const ref = typeof nodo?.$ref === "string" ? nodo.$ref : "";
  return ref.startsWith("#/components/schemas/") ? ref.slice("#/components/schemas/".length) : "";
}

/** "array de PuntoPoligonoDto", "integer", "string (enum)". */
function describirTipo(schema: Json | undefined, schemas: Json): string {
  if (!schema) return "—";
  const nombre = nombreDeRef(schema);
  if (nombre) return nombre;
  if (schema.type === "array") {
    const items = schema.items ?? {};
    const nombreItems = nombreDeRef(items);
    return `array de ${nombreItems || items.type || "algo"}`;
  }
  if (Array.isArray(schema.enum)) return `${schema.type ?? "string"} (enum)`;
  if (schema.type) return String(schema.type);
  if (schema.properties) return "object";
  return "—";
}

/** minLength/maxLength/pattern/min/max/minItems, en una línea legible. */
function describirRestricciones(schema: Json | undefined): string {
  if (!schema) return "";
  const partes: string[] = [];
  if (typeof schema.minLength === "number") partes.push(`mín. ${schema.minLength} car.`);
  if (typeof schema.maxLength === "number") partes.push(`máx. ${schema.maxLength} car.`);
  if (typeof schema.minimum === "number") partes.push(`≥ ${schema.minimum}`);
  if (typeof schema.maximum === "number") partes.push(`≤ ${schema.maximum}`);
  if (typeof schema.minItems === "number") partes.push(`mín. ${schema.minItems} elementos`);
  if (typeof schema.pattern === "string") partes.push(`patrón ${schema.pattern}`);
  if (typeof schema.format === "string") partes.push(`formato ${schema.format}`);
  return partes.join(" · ");
}

function opcionesDe(schema: Json | undefined): string[] {
  return Array.isArray(schema?.enum) ? schema.enum.map((v: unknown) => String(v)) : [];
}

/**
 * Valor de ejemplo para el esqueleto del cuerpo. No inventa datos que puedan
 * confundirse con reales: strings vacíos, ceros y arrays de un elemento.
 */
function valorDeEjemplo(schema: Json | undefined, schemas: Json, profundidad = 0): unknown {
  const s = resolverRef(schema, schemas);
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  switch (s.type) {
    case "integer":
    case "number":
      return typeof s.minimum === "number" ? s.minimum : 0;
    case "boolean":
      return false;
    case "array":
      if (profundidad > 2) return [];
      return [valorDeEjemplo(s.items, schemas, profundidad + 1)];
    case "object":
    default: {
      if (!s.properties || profundidad > 2) return s.type === "string" ? "" : {};
      const salida: Json = {};
      for (const [nombre, prop] of Object.entries<Json>(s.properties)) {
        salida[nombre] = valorDeEjemplo(prop, schemas, profundidad + 1);
      }
      return salida;
    }
  }
}

function construirCuerpo(op: Json, schemas: Json, anotado: Json): CuerpoVista | null {
  const requestBody = op.requestBody as Json | undefined;
  if (!requestBody) return null;
  const content = (requestBody.content ?? {}) as Json;
  const contentType = Object.keys(content)[0] ?? "application/json";
  const schemaRef = content[contentType]?.schema as Json | undefined;
  const schema = resolverRef(schemaRef, schemas);
  const requeridos: string[] = Array.isArray(schema.required) ? schema.required : [];

  const campos: CampoCuerpo[] = Object.entries<Json>(schema.properties ?? {}).map(
    ([nombre, prop]) => ({
      nombre,
      tipo: describirTipo(prop, schemas),
      requerido: requeridos.includes(nombre),
      descripcion: String(prop?.description ?? anotado?.[nombre] ?? ""),
      opciones: opcionesDe(prop),
      restricciones: describirRestricciones(prop),
    }),
  );

  return {
    requerido: requestBody.required !== false,
    contentType,
    schemaNombre: nombreDeRef(schemaRef),
    descripcion: String(requestBody.description ?? ""),
    campos,
    esqueleto: JSON.stringify(valorDeEjemplo(schemaRef, schemas), null, 2),
  };
}

function construirRespuestas(op: Json, anotadas: Json): RespuestaVista[] {
  const salida: RespuestaVista[] = [];
  for (const [codigo, cuerpo] of Object.entries<Json>((op.responses ?? {}) as Json)) {
    const anot = anotadas?.[codigo] ?? {};
    salida.push({
      codigo,
      descripcion: String(anot.descripcion ?? cuerpo?.description ?? ""),
      ejemplo: String(anot.ejemplo ?? ""),
    });
  }
  // Respuestas anotadas que el generador no conocía (los 4xx reales).
  for (const [codigo, anot] of Object.entries<Json>(anotadas ?? {})) {
    if (salida.some((r) => r.codigo === codigo)) continue;
    salida.push({
      codigo,
      descripcion: String(anot?.descripcion ?? ""),
      ejemplo: String(anot?.ejemplo ?? ""),
    });
  }
  return salida.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// ── Construcción ────────────────────────────────────────────────────────────

/**
 * Aplana el documento mergeado. `catalogo.documento` ya trae las anotaciones
 * aplicadas encima de lo generado (ver spec.ts), así que acá sólo se lee.
 */
export function construirVista(catalogo: CatalogoDocs): VistaDocs {
  const doc = catalogo.documento as Json;
  const schemas = (doc.components?.schemas ?? {}) as Json;
  const endpoints: EndpointVista[] = [];

  for (const [ruta, item] of Object.entries<Json>((doc.paths ?? {}) as Json)) {
    for (const metodo of METODOS) {
      const op = item?.[metodo] as Json | undefined;
      if (!op) continue;

      const metodoMayus = metodo.toUpperCase();
      const auth = String(op["x-goya-auth"] ?? "sin declarar");
      const categoriaAuth = clasificarAuth(auth, op["x-goya-categoria-auth"]);
      const anotParams = (op["x-goya-parametros"] ?? {}) as Json;

      const parametros: ParametroVista[] = (Array.isArray(op.parameters) ? op.parameters : []).map(
        (p: Json) => ({
          nombre: String(p?.name ?? ""),
          ubicacion: (p?.in === "query" || p?.in === "header" ? p.in : "path") as ParametroVista["ubicacion"],
          requerido: Boolean(p?.required),
          tipo: describirTipo(p?.schema, schemas),
          descripcion: String(anotParams[String(p?.name ?? "")] ?? p?.description ?? ""),
          opciones: opcionesDe(p?.schema),
          restricciones: describirRestricciones(p?.schema),
        }),
      );

      const cuerpo = construirCuerpo(op, schemas, (op["x-goya-cuerpo-campos"] ?? {}) as Json);
      if (cuerpo && typeof op["x-goya-cuerpo"] === "string") {
        cuerpo.descripcion = op["x-goya-cuerpo"];
      }

      const erroresAnotados: ErrorVista[] = (Array.isArray(op["x-goya-errores"])
        ? op["x-goya-errores"]
        : []
      ).map((e: Json) => ({
        codigo: String(e?.codigo ?? ""),
        cuando: String(e?.cuando ?? ""),
        cuerpo: String(e?.cuerpo ?? ""),
      }));

      const ejemplos: EjemploVista[] = (Array.isArray(op["x-goya-ejemplos"])
        ? op["x-goya-ejemplos"]
        : []
      ).map((e: Json) => ({
        titulo: String(e?.titulo ?? "Ejemplo"),
        lenguaje: String(e?.lenguaje ?? "bash"),
        codigo: String(e?.codigo ?? ""),
      }));

      const consumidores: string[] = Array.isArray(op["x-goya-consumidores"])
        ? op["x-goya-consumidores"].map(String)
        : [];

      const endpoint: EndpointVista = {
        id: idEndpoint(metodoMayus, ruta),
        metodo: metodoMayus,
        ruta,
        modulo: (Array.isArray(op.tags) && op.tags[0]) || "sin módulo",
        resumen: String(op.summary ?? ""),
        descripcion: String(op.description ?? ""),
        auth,
        categoriaAuth,
        consumidores,
        notas: String(op["x-goya-notas"] ?? ""),
        origen: String(op["x-goya-origen"] ?? ""),
        archivo: String(op["x-goya-archivo"] ?? ""),
        anotado: Boolean(op["x-goya-anotado"]),
        esEscritura: ESCRITURA.has(metodoMayus),
        parametros,
        cuerpo,
        respuestas: construirRespuestas(op, (op["x-goya-respuestas"] ?? {}) as Json),
        errores: [...erroresAnotados, ...erroresDelGuard(categoriaAuth)],
        ejemplos,
        busqueda: "",
      };

      endpoint.busqueda = normalizar(
        [
          endpoint.metodo,
          endpoint.ruta,
          endpoint.modulo,
          endpoint.resumen,
          endpoint.descripcion,
          endpoint.auth,
          endpoint.notas,
          endpoint.archivo,
          consumidores.join(" "),
          parametros.map((p) => `${p.nombre} ${p.descripcion}`).join(" "),
          cuerpo?.campos.map((c) => c.nombre).join(" ") ?? "",
        ].join(" · "),
      );

      endpoints.push(endpoint);
    }
  }

  endpoints.sort(
    (a, b) =>
      a.modulo.localeCompare(b.modulo) ||
      a.ruta.localeCompare(b.ruta) ||
      a.metodo.localeCompare(b.metodo),
  );

  const modulos = Array.from(
    endpoints.reduce((mapa, e) => {
      const actual = mapa.get(e.modulo) ?? { nombre: e.modulo, cantidad: 0, sinAuth: 0 };
      actual.cantidad += 1;
      if (e.categoriaAuth === "ninguna") actual.sinAuth += 1;
      mapa.set(e.modulo, actual);
      return mapa;
    }, new Map<string, { nombre: string; cantidad: number; sinAuth: number }>()),
  )
    .map(([, v]) => v)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const porCategoria = CATEGORIAS_AUTH.map((categoria) => {
    const lista = endpoints.filter((e) => e.categoriaAuth === categoria);
    return {
      categoria,
      cantidad: lista.length,
      endpoints: lista.map((e) => `${e.metodo} ${e.ruta}`),
    };
  }).filter((c) => c.cantidad > 0);

  const advertencias: AdvertenciaVista[] = (
    Array.isArray(doc["x-goya-advertencias"]) ? doc["x-goya-advertencias"] : []
  ).map((a: Json) => ({
    titulo: String(a?.titulo ?? ""),
    severidad: String(a?.severidad ?? "media"),
    detalle: String(a?.detalle ?? ""),
    afecta: String(a?.afecta ?? ""),
  }));

  return {
    titulo: String(doc.info?.title ?? "API"),
    version: String(doc.info?.version ?? ""),
    endpoints,
    modulos,
    resumen: {
      total: endpoints.length,
      porCategoria,
      sinValidacion: endpoints.filter((e) => esSinValidacion(e.categoriaAuth)),
      advertencias,
    },
    huerfanas: catalogo.huerfanas,
    anotados: endpoints.filter((e) => e.anotado).length,
  };
}
