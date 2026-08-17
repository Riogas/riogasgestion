// Paths de documentación que el proxy catch-all (`src/app/api/[...path]/route.ts`)
// NUNCA republica hacia el backend.
//
// El catch-all reenvía cualquier `/api/*` que no matchee un route handler propio.
// El Swagger vivo de NestJS se registra con `SwaggerModule.setup()` sobre el http
// adapter de Express, o sea FUERA del pipeline de guards de Nest: si estuviera
// montado, `/api/docs-json` devolvería el catálogo completo de la API sin
// autenticación ninguna, y el proxy lo republicaría desde el server de Next.
//
// El Swagger ya está apagado salvo `SWAGGER_ENABLED=1` (backend/src/main.ts),
// pero eso es una variable de entorno: alcanza con que alguien la prenda para
// depurar y se la olvide prendida. Este bloqueo es de código y no depende de la
// configuración — dos candados independientes para la misma puerta.
//
// El catálogo se lee por `/dashboard/docs`, que pasa por el gate root
// (`src/lib/docs/root-guard.ts`).

/** Primer segmento después de `/api/` que se bloquea, sea cual sea el método. */
export const SEGMENTOS_DOC_BLOQUEADOS = new Set(["docs", "docs-json", "docs-yaml"]);

/**
 * ¿Este pathname es (o cuelga de) un path de documentación del backend?
 *
 * Recibe el pathname completo del request (`/api/docs-json`, `/api/docs/`, …).
 * Compara sólo el primer segmento después de `/api`, así `/api/docs/algo`
 * también queda afuera. No matchea prefijos parciales: `/api/docsfalsos` pasa.
 *
 * Ojo: `/api/docs/spec` es un route handler propio de Next y nunca llega al
 * catch-all (los archivos concretos ganan sobre el `[...path]`), así que el
 * portal sigue funcionando.
 */
export function esPathDeDocumentacion(pathname: string): boolean {
  const sinPrefijo = pathname.replace(/^\/api(?=\/|$)/, "");
  const primero = sinPrefijo.split("/").filter(Boolean)[0] ?? "";
  return SEGMENTOS_DOC_BLOQUEADOS.has(primero.toLowerCase());
}
