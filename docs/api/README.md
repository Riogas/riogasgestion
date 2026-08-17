# Catálogo de APIs de GOYA

Fuente del portal `/dashboard/docs`
([`docs/superpowers/specs/2026-08-17-portal-docs-apis-design.md`](../superpowers/specs/2026-08-17-portal-docs-apis-design.md)).

| Archivo | Qué es |
|---|---|
| `openapi.json` | **Generado.** OpenAPI 3.1 con los 108 endpoints de la app. No editar a mano. |
| `anotaciones.yaml` | **A mano.** Resumen, auth real, consumidores, parámetros, respuestas, errores y ejemplos. Gana siempre sobre lo generado. |
| `README.md` | Este archivo. |

El merge de los dos lo hace `src/lib/docs/spec.ts`, `src/lib/docs/vista.ts` lo
aplana en el modelo que dibuja la pantalla, y lo sirven `GET /api/docs/spec` y
la página `/dashboard/docs`, ambos detrás del gate root de
`src/lib/docs/root-guard.ts`.

| Pieza | Archivo |
|---|---|
| Gate root (firma HS256 + `exp` + `docs:view` contra secapi) | `src/lib/docs/root-guard.ts` |
| Merge generado + anotaciones | `src/lib/docs/spec.ts` |
| Modelo de vista (categorías de auth, errores del guard, esqueleto del cuerpo) | `src/lib/docs/vista.ts` |
| Ejemplos copiables (curl / fetch / VB6) | `src/lib/docs/ejemplos.ts` |
| Motor del "probar" | `src/lib/docs/try-ejecutor.ts` + `src/app/api/docs/try/route.ts` |
| Visor | `src/components/docs/` |
| Página | `src/app/dashboard/docs/page.tsx` |
| Tests | `pnpm test:docs` (6 archivos en `src/lib/docs/*.test.ts`) |

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

### `DOCS_TRY_ORIGEN` — a dónde sale el "probar" (opcional)

| Variable | Sin ella | Para qué |
|---|---|---|
| `DOCS_TRY_ORIGEN` | se usa `http://127.0.0.1:<PORT>` (loopback de este mismo proceso; `PORT` lo setea Next, y si no existe, 3000) | Origen contra el que `POST /api/docs/try` ejecuta la llamada. Es **la única** variable que decide el destino. |

Se resuelve en `resolverOrigenConfiable()` (`src/lib/docs/try-ejecutor.ts`), en
este orden y sin ninguna otra fuente:

1. `DOCS_TRY_ORIGEN`, si está: se usa tal cual, normalizada a esquema + host +
   puerto (se descartan path, query y credenciales embebidas). Tiene que ser
   `http://` o `https://`.
2. Si no está: `http://127.0.0.1:<PORT>`. Next setea `process.env.PORT` al
   puerto real en el que escucha (`next start` y `next dev -p` por igual), así
   que el default `3000` sólo aplica si la variable no existe.
3. Si no se puede resolver un origen de confianza —`DOCS_TRY_ORIGEN` que no
   parsea, esquema que no es http(s), o `PORT` que no es un puerto— el "probar"
   responde **503 `ORIGEN_NO_CONFIGURADO`** y no ejecuta nada. No se adivina.

**Nunca sale de un header.** `Host`, `x-forwarded-host`, `Origin` y `Referer`
los elige quien manda el request. Como la llamada del "probar" sale con el
`Authorization: Bearer <JWT del root>` y la `Cookie: token=<JWT>` puestos por el
servidor, derivar el destino de un header convertía el endpoint en un SSRF con
exfiltración de la sesión del root: un `x-forwarded-host: evil.example.com`
alcanzaba para que el JWT saliera al host del atacante y volviera hasta 1 MB de
la respuesta al navegador. Después de armar la URL final se **revalida** que su
origen siga siendo el de confianza (el de la env/loopback, no la base con la que
se armó); si no coincide, 400 `DESTINO_NO_PERMITIDO`.

Cuándo hace falta setearla:

- **Nunca, en el caso normal.** El loopback es el destino correcto: el "probar"
  tiene que pegarle a *esta* app, y hacerlo por `127.0.0.1` además evita la
  vuelta por nginx (y su WAF) y el hairpin de DNS.
- Sí hay que setearla si el request tiene que pasar por el proxy —por ejemplo
  para probar un endpoint cuyo comportamiento depende de headers que agrega
  nginx— o si la app corre detrás de un path base. En ese caso poné el origen
  público **de ese ambiente**: `DOCS_TRY_ORIGEN=https://goya-dev.glp.riogas.com.uy`
  en dev y el de prod en prod. Un valor copiado del ambiente equivocado manda la
  llamada al ambiente equivocado, y el portal es solo-root: puede escribir.
- En local con `pnpm dev` (puerto 4000) no hace falta: `PORT` ya vale 4000.

El header `Origin` del navegador se sigue mirando, pero **sólo** para el chequeo
anti-CSRF (tiene que coincidir con el host por el que entró el request). No
elige destino.

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

Hoy: **104 de 108 operaciones con summary** (antes eran 14 de 102). Las 4 que
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
      Texto largo. Se renderiza con párrafos y `código` entre backticks.
    auth: JWT (Bearer)
    categoria: jwt          # jwt | api-key | sesion | root | publica | delegada | ninguna
    consumidores:
      - Pantalla /dashboard/clientes
      - VB6                 # si dice VB6, el visor agrega el ejemplo en VB6
    parametros:
      id: Id de cliente_uni (no es el CLIID del AS400).
    cuerpo: |
      Qué se manda en el body, en criollo.
    respuestas:
      "200":
        descripcion: La ficha con direcciones y teléfonos.
        ejemplo: |
          { "id": 123, "nombre": "…" }
    errores:
      - codigo: "404"
        cuando: El id no existe
        cuerpo: '{ "message": "Cliente no encontrado" }'
    notas: |
      Lo que el generador no puede saber.
    ejemplos:
      - titulo: curl con la key
        lenguaje: bash
        codigo: |
          curl -H "Authorization: Bearer $TOKEN" {origen}/api/clientes/123
```

Todos los campos son opcionales. La anotación pisa `summary`, `description` y
`x-goya-auth` de lo generado, y agrega el resto como extensiones `x-goya-*`.

Dos detalles que importan:

- **`{origen}`** en el código de un ejemplo se reemplaza en runtime por el host
  del ambiente en el que está parado el navegador. Nunca escribas un host ni una
  IP a mano: un ejemplo con `goya-dev` pegado adentro es un ejemplo que alguien
  va a copiar y correr contra el ambiente equivocado. Lo mismo vale para los
  ejemplos **generados** (curl / fetch / VB6): salen de
  `src/lib/docs/ejemplos.ts` con `window.location.origin`.
- **`categoria`** existe porque la heurística del generador se equivoca y hay
  que poder corregirla. El caso testigo es
  `POST /api/sorteo-publico/participar`: el archivo menciona `x-api-key` porque
  la key la agrega ESE handler hacia el backend, pero para el navegador el
  endpoint es público. Sin el override, el panel de autenticación contaría un
  endpoint protegido que en realidad está abierto.

Si una key del yaml no matchea ningún endpoint del `openapi.json`, aparece
listada como "anotación sin endpoint" arriba de todo en `/dashboard/docs` (el
yaml quedó desactualizado) y el test antienvejecimiento falla.

### Advertencias transversales

Arriba de `endpoints:` el yaml tiene una lista `advertencias:` con lo que **no**
se puede inferir de ningún endpoint: que el `AuthGuard` no distingue rol, que
sin `JWT_SECRET` la firma no se verifica, que `CallesApiKeyGuard` deja pasar
cualquier JWT decodificable, etc. Cada una lleva `titulo`, `severidad`
(`alta`/`media`), `afecta` y `detalle`, y se muestran en la pestaña "Estado de
la autenticación". Un endpoint puede declarar autenticación y no proteger nada:
esa lista es la que lo dice.

---

## Test antienvejecimiento

```bash
pnpm test:docs
```

`src/lib/docs/cobertura-anotaciones.test.ts` **falla si aparece un endpoint sin
entrada en `anotaciones.yaml`**. Chequea cinco cosas:

1. Todo endpoint del `openapi.json` está anotado **o** figura en la lista de
   excepciones.
2. La lista de excepciones no tiene entradas que sobren (un endpoint que ya se
   anotó o que se borró del código).
3. No hay anotaciones huérfanas (keys que no matchean ningún endpoint).
4. Los endpoints con **consumidor externo** (calles/VB6, mostrador, el webhook
   de TrackMovil, los públicos de sorteos) están anotados sí o sí. Esa lista
   está escrita a mano en el test: son contratos con código que no vive en este
   repo.
5. Todo endpoint anotado declara `auth` y `consumidores` (no se acepta una
   anotación a medias).

La lista de excepciones es **`src/lib/docs/anotaciones-pendientes.ts`**, un
array explícito con los 73 endpoints que quedaron sin anotar el 2026-08-17.
Existe para que el test arranque verde con la deuda de ese día y falle sólo con
los nuevos.

> **La lista no crece.** Un endpoint nuevo se anota en `anotaciones.yaml`; no se
> agrega a la lista de excepciones. Y cuando se anota uno viejo, hay que sacarlo
> de la lista: el punto 2 hace fallar el test si sobra.

Los 73 pendientes son CRUD interno del panel (móviles, puestos, fleteras,
catálogos, workbench, admin de sorteos): sin consumidor externo, y con el
contrato ya descripto por el generador a partir de los DTOs de class-validator.

---

## Probar un endpoint desde el portal — `POST /api/docs/try`

El botón "Probar" de cada ficha ejecuta la llamada **del lado del servidor**,
con la sesión del root que está mirando la pantalla. El motor está en
`src/lib/docs/try-ejecutor.ts` y las reglas no se negocian:

| Regla | Por qué |
|---|---|
| `requireRoot` **antes de leer el cuerpo**, en el route handler | El gate es lo primero que corre en el `POST`: un anónimo no tiene por qué hacernos parsear un JSON arbitrario (memoria gastada pre-auth). `manejarTry` lo vuelve a verificar porque es el módulo dueño de la regla; la segunda pasada sale gratis por la caché del guard. |
| El destino sale de `DOCS_TRY_ORIGEN` / loopback, **nunca de un header** | Ver la sección de la variable más arriba. El fetch lleva el JWT del root: si el destino saliera del `Host` o del `x-forwarded-host`, sería un SSRF con exfiltración de la sesión. |
| El pedido viaja en base64 (`{ payload }`) | Un cuerpo con sintaxis de shell no atraviesa el WAF de nginx si va en claro. Mismo contrato que en las otras dos apps. |
| Sólo paths que empiecen con `/api/` | **Nunca** es un proxy abierto. Se rechaza la URL absoluta, `//host`, `\`, `..`, `%2e`, `%2f`, la query pegada al path y el propio `/api/docs/try`. Y la URL ya armada se revalida contra el origen de confianza → 400 `DESTINO_NO_PERMITIDO`. |
| `GET`/`HEAD` directo; el resto exige `confirmacion` = el path exacto | Es root y el ambiente puede ser producción. Sin coincidencia → **428 `CONFIRMACION_REQUERIDA`**. |
| `authorization` y `cookie` los pone el servidor | Si los pudiera elegir el cliente, esto sería una máquina de firmar requests con credenciales ajenas. El resto de los headers (incluida una `x-api-key` para probar los endpoints del VB6) pasa. |
| Timeout 30 s, respuesta truncada a 1 MB | El ZIP de un lote de QRs son cientos de MB: se lee con tope y se corta el stream. |
| Se exige `Origin` = el host por el que entró el request, si vino | Anti-CSRF: sin esto, una página de otro dominio podría disparar escrituras con la cookie del root. Es lo único para lo que se miran esos headers; el destino del fetch no depende de ellos. |

Devuelve `{ status, statusText, headers, body, duracionMs, truncado }`. El
status del endpoint probado va **adentro** del cuerpo: un 401 del destino sigue
siendo un 200 del `try`.

En la UI, las escrituras abren un diálogo que exige **escribir el path exacto** y
muestra el ambiente derivado del host (si el host dice `dev` es DEV; localhost es
LOCAL; **cualquier otra cosa se trata como PRODUCCIÓN** y se pinta en rojo — el
default tiene que ser el que asusta).

`/api/docs/try` es un route handler propio de Next, así que no pasa por el
catch-all `/api/[...path]` ni lo alcanza el bloqueo de
`src/lib/docs/paths-bloqueados.ts` (que sí bloquearía cualquier `/api/docs*` que
llegara al proxy).

---

## Qué quedó fuera (y por qué)

- **Las notas a mano de los 73 endpoints de CRUD interno.** Están anotados los
  35 que tienen consumidor externo o que son camino crítico; el resto vive en la
  lista de excepciones del test antienvejecimiento. El generador ya describe su
  contrato a partir de los DTOs.
- **El `summary` de los 4 endpoints de `/api/mostrador/*`.** Es código de otra
  tanda, commiteado mientras se hacía este cambio; se resuelve con una línea de
  JSDoc arriba de cada método de `backend/src/mostrador/mostrador.controller.ts`.
  (La anotación a mano ya les puso resumen, auth y consumidores en el portal.)
- **Los endpoints legacy de GeneXus** que se alcanzan por el catch-all
  `/api/[...path]`. Se documenta que el proxy existe y a dónde apunta, no cada
  endpoint del otro lado.
- **Los códigos de respuesta reales.** Sin `@ApiResponse` el generador pone el
  código por defecto de Nest (201 en POST, 200 en el resto) con descripción
  vacía. Los 4xx/5xx concretos se anotan a mano en `respuestas` y `errores`.
  Los 401 del guard **sí** salen solos: los deriva `erroresDelGuard()` en
  `vista.ts` a partir de la categoría de autenticación, con los textos de los
  guards reales.
- **La autenticación inferida del front es una heurística de texto** (busca
  `x-api-key`, `cookies.get("token")`, `authorization` en el archivo). Se
  equivoca, y a propósito: es un piso, no la verdad. Se corrige con `categoria`
  en la anotación (ver `POST /api/sorteo-publico/participar`, `GET /api/docs/spec`
  y los cinco `/api/{path}` del proxy).
- **`GET /api/health` existe dos veces** — en el backend Nest y como healthcheck
  del contenedor Next. OpenAPI no admite dos operaciones con el mismo método y
  path: queda la del backend, y la del front va anotada dentro de ella en
  `x-goya-tambien-en-front`.
