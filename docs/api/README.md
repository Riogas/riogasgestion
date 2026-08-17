# Catálogo de APIs de GOYA

Fuente del portal `/dashboard/docs` (fase 1–3 de
[`docs/superpowers/specs/2026-08-17-portal-docs-apis-design.md`](../superpowers/specs/2026-08-17-portal-docs-apis-design.md)).

| Archivo | Qué es |
|---|---|
| `openapi.json` | **Generado.** OpenAPI 3.1 con los 102 endpoints de la app. No editar a mano. |
| `anotaciones.yaml` | **A mano.** Resumen, auth real, consumidores, notas y ejemplos. Gana siempre sobre lo generado. |
| `README.md` | Este archivo. |

El merge de los dos lo hace `src/lib/docs/spec.ts`, y lo sirven
`GET /api/docs/spec` y la página `/dashboard/docs` (ambos detrás del gate root
de `src/lib/docs/root-guard.ts`, que verifica `docs:view` contra secapi en cada
request y es fail-closed).

## Regenerar

```bash
pnpm docs:api
```

Escribe `docs/api/openapi.json` y hay que commitearlo. Es reproducible: dos
corridas seguidas producen bytes idénticos (paths ordenados alfabéticamente y
sin timestamps), así que el diff de git muestra sólo lo que cambió de verdad
en las APIs.

Qué hace por dentro (`backend/scripts/generate-openapi.ts`):

1. **Backend NestJS** — construye el `AppModule` en memoria con
   `NestFactory.create({ logger: false })` y le pide el documento a
   `SwaggerModule.createDocument()`. **No levanta ningún puerto y no se conecta
   a Postgres**: `PrismaService` conecta recién en `onModuleInit`, hook que sólo
   dispara `app.init()` — que el script nunca llama. Correlo sin base levantada
   funciona igual. Lo que sí hace falta es el cliente de Prisma generado
   (`pnpm --filter riogas-backend prisma:generate`), porque el módulo lo importa.
2. **Front Next** — escanea `src/app/api/**/route.ts` en forma estática: el path
   sale de la estructura de carpetas (`[...path]` → `{path}`), los métodos de
   los `export async function GET|POST|…`, y la descripción del comentario de
   cabecera del archivo.
3. Ordena, cuenta y escribe.

Se corre con el `ts-node` del workspace `backend` y no con `tsx`: esbuild no
emite `emitDecoratorMetadata` y sin esa metadata la inyección de dependencias
de Nest rompe.

## Anotar un endpoint nuevo

1. `pnpm docs:api` — que la ruta aparezca en `openapi.json`.
2. Agregar la entrada en `anotaciones.yaml` con la key **`MÉTODO /path`**, con el
   path tal cual quedó en `openapi.json` (parámetros entre llaves):

```yaml
endpoints:
  "GET /api/clientes/{id}":
    resumen: Ficha completa del cliente unificado
    descripcion: |
      Texto largo, markdown.
    auth: JWT (Bearer)
    consumidores:
      - Pantalla /dashboard/clientes
      - VB6
    notas: |
      Lo que el generador no puede saber.
    ejemplos:
      - titulo: curl
        lenguaje: bash
        codigo: |
          curl -H "Authorization: Bearer $TOKEN" https://goya-dev.glp.riogas.com.uy/api/clientes/123
```

Todos los campos son opcionales. La anotación pisa `summary`, `description` y
`x-goya-auth` de lo generado, y agrega `x-goya-consumidores`, `x-goya-notas` y
`x-goya-ejemplos`.

Si una key del yaml no matchea ningún endpoint del `openapi.json`, aparece
listada como "anotación sin endpoint" arriba de todo en `/dashboard/docs` (el
yaml quedó desactualizado). El test que **falla** ante endpoints sin anotar es
la fase 7 del diseño; todavía no está.

## Qué quedó fuera (y por qué)

- **Descripciones reales de la mayoría de los endpoints.** El backend casi no
  tiene `@ApiOperation`, así que el `summary` viene vacío en 90 de las 102
  operaciones. Se llenan desde `anotaciones.yaml` (fase 6), no tocando los
  controllers.
- **`POST /api/docs/try`** (ejecutar la llamada desde el portal) y el visor con
  búsqueda, parámetros y ejemplos: fases 4 y 5.
- **Los endpoints legacy de GeneXus** que se alcanzan por el catch-all
  `/api/[...path]`. Se documenta que el proxy existe y a dónde apunta, no cada
  endpoint del otro lado.
- **El Swagger vivo de `/api/docs` del backend** sigue como está: apagado
  cuando `NODE_ENV=production`. El portal sirve el JSON versionado justamente
  para no depender de eso. `backend/src/main.ts` no se tocó; el generador repite
  el mismo `DocumentBuilder` y le agrega `setOpenAPIVersion('3.1.0')`.
- **La autenticación inferida del front es una heurística de texto** (busca
  `x-api-key`, `cookies.get("token")`, `authorization` en el archivo). Se
  equivoca, y a propósito: es un piso, no la verdad. Dos casos ya corregidos por
  anotación viven en `anotaciones.yaml` (`POST /api/sorteo-publico/participar`
  y `GET /api/docs/spec`).
- **`GET /api/health` existe dos veces** — en el backend Nest y como healthcheck
  del contenedor Next. OpenAPI no admite dos operaciones con el mismo método y
  path: queda la del backend, y la del front va anotada dentro de ella en
  `x-goya-tambien-en-front`.
