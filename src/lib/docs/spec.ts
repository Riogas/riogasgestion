// Carga y merge del catálogo de APIs que consume el portal /dashboard/docs.
//
//   docs/api/openapi.json   ← generado por `pnpm docs:api` (no editar a mano)
//   docs/api/anotaciones.yaml ← escrito a mano: resumen, auth real, consumidores,
//                               notas y ejemplos
//
// Las anotaciones SIEMPRE ganan sobre lo inferido por el generador: lo generado
// no envejece pero tampoco sabe quién consume cada endpoint ni con qué key.
// Si el yaml no existe todavía, se devuelve el documento generado tal cual.
import fs from "node:fs";
import path from "node:path";
// js-yaml 5 es ESM puro y no tiene default export: import nombrado, no `import yaml from`.
import { load as parsearYaml } from "js-yaml";

const DIR_DOCS = path.join(process.cwd(), "docs", "api");
const ARCHIVO_OPENAPI = path.join(DIR_DOCS, "openapi.json");
const ARCHIVO_ANOTACIONES = path.join(DIR_DOCS, "anotaciones.yaml");

const METODOS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

export interface Anotacion {
  resumen?: string;
  descripcion?: string;
  auth?: string;
  consumidores?: string[];
  notas?: string;
  ejemplos?: Array<{ titulo?: string; lenguaje?: string; codigo?: string }>;
}

/** Entrada plana para la lista de la página. */
export interface EndpointDoc {
  metodo: string;
  ruta: string;
  modulo: string;
  resumen: string;
  auth: string;
  origen: string;
  anotado: boolean;
  consumidores: string[];
}

export interface CatalogoDocs {
  documento: Record<string, unknown>;
  endpoints: EndpointDoc[];
  /** Anotaciones que no matchean ningún endpoint del generado (yaml desactualizado). */
  huerfanas: string[];
}

function leerAnotaciones(): Record<string, Anotacion> {
  if (!fs.existsSync(ARCHIVO_ANOTACIONES)) return {};
  const crudo = parsearYaml(fs.readFileSync(ARCHIVO_ANOTACIONES, "utf8")) as
    | { endpoints?: Record<string, Anotacion> }
    | null
    | undefined;
  return crudo?.endpoints ?? {};
}

/** La key de anotación es "MÉTODO /path", p.ej. "GET /api/calles/buscar". */
function claveEndpoint(metodo: string, ruta: string): string {
  return `${metodo.toUpperCase()} ${ruta}`;
}

/**
 * Devuelve el documento OpenAPI mergeado + la lista plana que dibuja la página.
 * Lee de disco en cada llamada a propósito: el archivo se regenera con
 * `pnpm docs:api` y así no hace falta reiniciar el server para verlo.
 */
export function cargarCatalogo(): CatalogoDocs {
  if (!fs.existsSync(ARCHIVO_OPENAPI)) {
    throw new Error(
      "Falta docs/api/openapi.json — generalo con `pnpm docs:api` antes de abrir el portal.",
    );
  }

  const documento = JSON.parse(fs.readFileSync(ARCHIVO_OPENAPI, "utf8")) as Record<string, any>;
  const anotaciones = leerAnotaciones();
  const usadas = new Set<string>();
  const endpoints: EndpointDoc[] = [];

  for (const [ruta, item] of Object.entries(documento.paths ?? {})) {
    for (const metodo of METODOS) {
      const op = (item as Record<string, any>)?.[metodo];
      if (!op) continue;

      const clave = claveEndpoint(metodo, ruta);
      const anot = anotaciones[clave];
      if (anot) {
        usadas.add(clave);
        if (anot.resumen) op.summary = anot.resumen;
        if (anot.descripcion) op.description = anot.descripcion;
        if (anot.auth) op["x-goya-auth"] = anot.auth;
        if (anot.consumidores) op["x-goya-consumidores"] = anot.consumidores;
        if (anot.notas) op["x-goya-notas"] = anot.notas;
        if (anot.ejemplos) op["x-goya-ejemplos"] = anot.ejemplos;
        op["x-goya-anotado"] = true;
      }

      endpoints.push({
        metodo: metodo.toUpperCase(),
        ruta,
        modulo: (Array.isArray(op.tags) && op.tags[0]) || "sin módulo",
        resumen: op.summary ?? "",
        auth: op["x-goya-auth"] ?? "sin declarar",
        origen: op["x-goya-origen"] ?? "",
        anotado: Boolean(anot),
        consumidores: Array.isArray(op["x-goya-consumidores"]) ? op["x-goya-consumidores"] : [],
      });
    }
  }

  const huerfanas = Object.keys(anotaciones).filter((k) => !usadas.has(k));
  if (huerfanas.length) documento["x-goya-anotaciones-huerfanas"] = huerfanas;

  endpoints.sort(
    (a, b) => a.modulo.localeCompare(b.modulo) || a.ruta.localeCompare(b.ruta) || a.metodo.localeCompare(b.metodo),
  );

  return { documento, endpoints, huerfanas };
}

/** Agrupa por módulo (el primer tag de la operación) para la vista por secciones. */
export function agruparPorModulo(endpoints: EndpointDoc[]): Array<[string, EndpointDoc[]]> {
  const mapa = new Map<string, EndpointDoc[]>();
  for (const e of endpoints) {
    const lista = mapa.get(e.modulo) ?? [];
    lista.push(e);
    mapa.set(e.modulo, lista);
  }
  return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
}
