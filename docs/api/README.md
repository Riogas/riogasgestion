# Catálogo de APIs de GOYA

Fuente del portal `/dashboard/docs` (fase 1–3 de
[`docs/superpowers/specs/2026-08-17-portal-docs-apis-design.md`](../superpowers/specs/2026-08-17-portal-docs-apis-design.md)).

| Archivo | Qué es |
|---|---|
| `openapi.json` | **Generado.** OpenAPI 3.1 con los 107 endpoints de la app. No editar a mano. |
| `anotaciones.yaml` | **A mano.** Resumen, auth real, consumidores, notas y ejemplos. Gana siempre sobre lo generado. |
| `README.md` | Este archivo. |

El merge de los dos lo hace `src/lib/docs/spec.ts`, y lo sirven
`GET /api/docs/spec` y la página `/dashboard/docs`, ambos detrás del gate root
de `src/lib/docs/root-guard.ts`.

---

## Configuración obligatoria del server para que `/docs` abra

El portal es fail-closed **también ante mala configuración**: si el server no
está configurado, no abre y devuelve 503. Son dos variables:

| Variable | Sin ella | Por qué |
|---|---|---|
| `JWT_SECRET` | 503 `SECRETO_NO_CONFIGURADO` | Es el secreto con el que **secapi firma** los JWT. El guard verifica firma y vencimiento con `jsonwebtoken` (HS256) antes de cualquier otra cosa. |
| `SECAPI_URL` | 503 `SECAPI_URL_NO_CONFIGURADA` | Host de secapi contra el que se consulta el permiso `docs:view`. **No hay default**: un fallback a dev verificaría contra el padrón equivocado. |

`JWT_SECRET` tiene que ser **el mismo valor con el que secapi firma**, y no
puede ser el default público del código de secapi (`security-suite-secret-key`):
el guard trata ese valor como "no configurada" y devuelve 503 igual.

### Por qué el portal verifica la firma y el resto de la app no

Hoy, en las tres aplicaciones, el JWT **no se verifica**: `decodeJwtPayload()` es
`JSON.parse(base64)` y ni siquiera mira `exp`. Con eso, cualquiera arma

```
Authorization: Bearer xxx.<base64 de {"username":"dmedaglia"}>.yyy
```

y pasa por usuario válido. Para el 99 % de las pantallas eso es un problema
conocido que se arregla aparte (ver `AUTH_REQUIRE_JWT_SECRET` en
`backend/src/common/guards/auth.guard.ts`). Para **este** portal no se podía
dejar así: la pantalla lista, endpoint por endpoint, **cuáles no validan nada**.
Un token de mentira abriría el mapa completo de los agujeros de autenticación.

Por eso `requireRoot()` hace, en este orden:

1. **Local, sin red:** `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`.
   `TokenExpiredError` → 401 `TOKEN_VENCIDO`; `JsonWebTokenError` → 401
   `TOKEN_INVALIDO`. Va primero para no gastar una llamada a secapi con un token
   que ni siquiera está firmado, y va **antes de la caché**, así un token que se
   vence entre dos requests no entra aprovechando el `GRANTED` cacheado.
2. **Remota:** `POST {SECAPI_URL}/api/db/permisos` con `docs:view`. El JWT no
   lleva el flag root, así que quién es root sólo lo sabe secapi.

El cambio está **acotado al camino de `/docs`**: no se tocó `/api/db/permisos`,
ni el `AuthGuard` del backend, ni el login, ni `src/proxy.ts`.

Los tests están en `src/lib/docs/root-guard.test.ts` (`pnpm test:docs`): token
fabricado a mano → 401, firmado con otro secreto → 401, vencido → 401, `alg:none`
→ 401, sin `JWT_SECRET` o con el default → 503, sin `SECAPI_URL` → 503, firmado y
vigente → pasa.

### Riesgo anotado: `NODE_TLS_REJECT_UNAUTHORIZED=0`

`pm2.config.js` arranca el proceso de Next con `NODE_TLS_REJECT_UNAUTHORIZED=0`
(lo necesita el proxy legacy hacia GeneXus, que tiene certificado autofirmado).
Efecto colateral: **la consulta del guard a secapi viaja por HTTPS sin validar el
certificado**. Un atacante con capacidad de MITM entre el server de Goya y secapi
podría contestar `GRANTED`. No se toca acá porque es infraestructura y afecta a
todo el proceso; queda anotado como deuda. La mitigación real es sacar esa
variable y arreglar la cadena de certificados del proxy legacy.

---

## El Swagger vivo del backend está apagado

`backend/src/main.ts` monta `SwaggerModule` **sólo si `SWAGGER_ENABLED=1`**.
Antes la condición era `NODE_ENV !== 'production'` y `backend/.env` fija
`NODE_ENV=development`: en los hechos `/api/docs` y `/api/docs-json` servían el
catálogo completo **sin autenticación**, porque `SwaggerModule.setup()` registra
sus rutas sobre el http adapter de Express y queda **fuera del pipeline de guards
de Nest** (ningún `@UseGuards(AuthGuard)` lo cubre).

Dos candados, independientes entre sí:

1. **Config** — `SWAGGER_ENABLED`, explícita: ningún ambiente queda expuesto por
   arrastre de `NODE_ENV`. Con la variable ausente o distinta de `1`, Swagger no
   se monta. La línea `SWAGGER_ENABLED=0` con su explicación se agregó a
   `backend/.env.example`, pero **ese archivo no está en git**: `.gitignore`
   ignora `.env*` y sólo tiene opt-in para `.env.production.example`. Así que
   este README es la referencia versionada de la variable, y al actualizar un
   `.env` de un server hay que agregarla a mano.
2. **Código** — el catch-all `src/app/api/[...path]/route.ts` no republica
   `docs`, `docs-json` ni `docs-yaml`: devuelve 404 sin consultar al backend.
   Está en `src/lib/docs/paths-bloqueados.ts` para poder testearlo, y el test es
   `src/lib/docs/paths-bloqueados.test.ts` (bloquea los tres paths, con barra
   final, con subpath y en cualquier case; no se come `/api/documentos` ni
   `/api/docsfalsos`). Alcanza con que alguien prenda `SWAGGER_ENABLED=1` para
   depurar y se lo olvide prendido: el proxy igual no lo publica.

`/api/docs/spec` es un route handler propio de Next y **no** pasa por el
catch-all (los archivos concretos ganan sobre el `[...path]`), así que el portal
sigue funcionando.

---

## Regenerar

```bash
pnpm docs:api
```

Escribe `docs/api/openapi.json` y hay que commitearlo. Es reproducible: dos
corridas seguidas producen bytes idénticos (paths y schemas ordenados
alfabéticamente, sin timestamps), así que el diff de git muestra sólo lo que
cambió de verdad en las APIs.

### Cómo funciona (parser estático, no arranque de la app)

`backend/scripts/generate-openapi.ts` **lee el código con ts-morph; no ejecuta
nada del backend**. Antes levantaba el `AppModule` con `NestFactory` por
`ts-node` y le pedía el documento a `@nestjs/swagger`, lo que ataba el catálogo
de todo el repo a que **todo** `backend/src` compilara: un error de tipos en
cualquier módulo dejaba al repo sin catálogo (pasó con `backend/src/mostrador/`).
Ahora un módulo roto no puede romper la generación. Se corre con `tsx` desde la
raíz; el workspace `backend` ya no participa.

De yapa el documento salió **mejor** que el de Swagger: el backend no tiene un
solo `@ApiProperty` ni el plugin del CLI de Nest, así que los 23 schemas que
generaba salían **vacíos** (`"properties": {}`) y ninguna operación declaraba
query params. El parser los saca del código:

1. **Controllers** (`backend/src/**/*.controller.ts`): `@Controller` + `@Get`/
   `@Post`/…, path params de `@Param` (con `ParseIntPipe` → `integer`), query
   params de `@Query`, body de `@Body`, auth deducida de `@UseGuards`
   (`AuthGuard` → JWT, `*ApiKeyGuard` → x-api-key) y `security` de
   `@ApiBearerAuth`.
2. **DTOs** referenciados: propiedades con su tipo TS y las restricciones de
   class-validator (`@MaxLength` → `maxLength`, `@IsIn` → `enum`, `@Min` →
   `minimum`, `@IsEmail` → `format: email`, `@Type(() => X)` → `items.$ref`…),
   incluidos los mapped types `PartialType` / `OmitType` / `PickType`.
3. **Route handlers del front** (`src/app/api/**/route.ts`): el path sale de la
   estructura de carpetas (`[...path]` → `{path}`), los métodos de los
   `export async function GET|POST|…` y la descripción del comentario de cabecera.

### El `summary` de cada operación

Cadena de fallback, de mayor a menor prioridad:

1. `@ApiOperation({ summary })`
2. **el docblock del método** — JSDoc `/** … */`, o el bloque de líneas `//`
   pegado justo arriba (se descartan los separadores decorativos del tipo
   `// ── CRUD ──────`, para no robarse el comentario que agrupa varios métodos)
3. para el front, el comentario de cabecera del `route.ts`

Hoy: **103 de 107 operaciones con summary** (antes eran 14 de 102). Las 4 que
faltan son las de `backend/src/mostrador/`, que se commitearon mientras se hacía
este cambio; se arreglan con una línea de JSDoc, igual que el resto.

Documentar un endpoint nuevo es poner esa línea arriba del método; no hace falta
importar nada de `@nestjs/swagger`.

```ts
/** Listado paginado de clientes unificados, con búsqueda libre y filtros. */
@Get()
findAll(@Query() query: QueryClientesDto) { … }
```

### Módulos que todavía no están en el repo

```bash
pnpm docs:api --excluir=backend/src/mostrador
```

`--excluir=<texto>` omite los archivos cuyo path relativo contenga ese texto
(repetible; también `DOCS_API_EXCLUIR=a,b`). Sirve para un módulo que se está
escribiendo en otra rama y todavía no está commiteado: el `openapi.json`
versionado tiene que describir **el código que está en el repo**, no el del
working tree. El `openapi.json` de hoy no usa ninguna exclusión.

---

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

---

## Qué quedó fuera (y por qué)

- **Los consumidores, las keys reales y los ejemplos de la mayoría de los
  endpoints.** El generador saca el contrato del código, pero no sabe quién
  llama ni con qué key. Eso es `anotaciones.yaml` (fase 6): hoy hay 4 endpoints
  anotados.
- **El `summary` de los 4 endpoints de `/api/mostrador/*`.** Es código de otra
  tanda, commiteado mientras se hacía este cambio; se resuelve con una línea de
  JSDoc arriba de cada método de `backend/src/mostrador/mostrador.controller.ts`.
- **`POST /api/docs/try`** (ejecutar la llamada desde el portal) y el visor con
  búsqueda, parámetros y ejemplos: fases 4 y 5.
- **Los endpoints legacy de GeneXus** que se alcanzan por el catch-all
  `/api/[...path]`. Se documenta que el proxy existe y a dónde apunta, no cada
  endpoint del otro lado.
- **Los códigos de respuesta reales.** Sin `@ApiResponse` el generador pone el
  código por defecto de Nest (201 en POST, 200 en el resto) con descripción
  vacía. Los 4xx/5xx concretos se anotan a mano.
- **La autenticación inferida del front es una heurística de texto** (busca
  `x-api-key`, `cookies.get("token")`, `authorization` en el archivo). Se
  equivoca, y a propósito: es un piso, no la verdad. Dos casos ya corregidos por
  anotación viven en `anotaciones.yaml` (`POST /api/sorteo-publico/participar`
  y `GET /api/docs/spec`).
- **`GET /api/health` existe dos veces** — en el backend Nest y como healthcheck
  del contenedor Next. OpenAPI no admite dos operaciones con el mismo método y
  path: queda la del backend, y la del front va anotada dentro de ella en
  `x-goya-tambien-en-front`.
