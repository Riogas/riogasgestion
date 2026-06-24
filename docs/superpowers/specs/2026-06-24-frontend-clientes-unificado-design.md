# Módulo Clientes sobre el modelo unificado — Diseño

**Fecha:** 2026-06-24
**Estado:** Aprobado (pendiente de plan de implementación)
**Relacionados:** `2026-06-24-modelo-unificado-clientes-design.md` (modelo de datos), `2026-06-23-verificacion-coordenadas-clientes-design.md` (geoinversa)

## Objetivo

Adaptar el módulo de clientes de Goya (backend NestJS + frontend Next.js) para que opere **end-to-end sobre el modelo unificado** (`cliente_uni` + `cliente_direccion` + `cliente_telefono` + catálogos) que ya está migrado en Postgres goya. Hoy el front está construido para esa forma pero sus tipos están desfasados y el backend todavía lee la tabla plana `cliente`. El resultado: listar, ver ficha, **dar de alta de forma muy visual y rápida**, y editar clientes con **N direcciones** y **N teléfonos**, cada dirección con su propia geolocalización (Nominatim propio + mapa interactivo).

## Decisiones tomadas (confirmadas con el usuario)

1. **Backend:** NestJS + Prisma sobre `ClienteUni`. El front pasa a modo `nestjs`. (Descartado seguir en legacy GeneXus.)
2. **Escritura:** Lectura + edición en goya. El CRUD escribe a Postgres goya; la sync bidireccional a AS400 es una feature aparte diferida. Los datos pueden divergir de AS400 hasta entonces.
3. **Campos del form:** Alinear a los catálogos reales. Se descartan los campos inventados del front (`apellido`, enums `DOMESTICO/COMERCIAL`, `categoria`). Se usan `nombre` único, `tipoClienteId` y `categoriaPrecioId` como selects poblados desde `tipo_cliente` / `categoria_precio`.
4. **Alta:** Página completa **master-detail** con mapa compartido (NO slide-over). Un cliente único con 1..N direcciones y 1..N teléfonos.

## Fuera de alcance

- Tabs **Pedidos / Servicios / Cuenta** de la ficha: siguen mockeados (módulos futuros). El header conserva los KPI Saldo/Pedido como "próximamente".
- Sync bidireccional AS400 ↔ goya.
- Rename de `cliente_uni` → `cliente` y drop de las tablas planas `cliente` / `calle`. La tabla plana `cliente` sigue siendo escrita por la feature de verificación de coordenadas; renombrar/dropear es limpieza posterior.

## Datos reales (verificados en goya 192.168.2.117, 2026-06-24)

- `cliente_uni` = **1.130.155** (capital 933.959 + interior 196.196). `cliente_direccion` = 1.130.155 (hoy **todas `principal=true`, 1 por cliente**). `cliente_telefono` = 2.262.207.
- `tipo_cliente` = **29 filas** con descripciones reales (DOMESTICO, INDUSTRIA, RECARGADORES, BARES, COMERCIO, FLETERO CAPITAL, GRANEL DOMEST., INDISTINTO, …). `departamento` = 19. `localidad` = 158. `categoria_precio` ≈ 6.
- **Teléfono:** `tipo` casi todo NULL (capital 2.06M); códigos `PE`/`VE`/`TR`/`PU` (interior). `estado` ∈ `{A, P, 0, null}` — **CHAR(1)**, NO "ACTIVO".
- **Dirección `calleMatch`:** True 706.374, False 200.054, **None 223.727** (interior no tiene coordenadas → `calleMatch` null). `lat` presente solo en 906.428 (capital). `geoFuente` ∈ `{sad, ica, dircor, interior}`.
- **Estado cliente:** `A` 636.121, `P` 493.341, `R` 686, null 7. `dedupRevisar=true` en 11.317 (posibles duplicados).

> Implicación: el interior no tiene coordenadas. En la lista y la ficha, GPS de esas direcciones se muestra "s/coord" (no ✗). El geocoder permite asignarle coordenadas a mano (tocar el mapa) y guardar.

## Arquitectura

```
Next.js (front, modo nestjs)
   │  axios api → NEXT_PUBLIC_NEST_URL (NestJS)
   ▼
NestJS (backend) ── AuthGuard valida JWT de secapi (iss "security-suite")
   │  Prisma
   ▼
Postgres goya: cliente_uni / cliente_direccion / cliente_telefono / catálogos
```

Se **repurposa el módulo `clientes` existente** (back y front) en vez de crear uno paralelo. El front ya tiene la UI (tabs, AddressPicker, marcar principal); se realinean tipos y se cablean datos reales.

---

## Backend NestJS

### Modelo Prisma
Se usa `ClienteUni` (sin renombrar la tabla). `ClienteTelefono` y `ClienteDireccion` ya tienen relación `@relation(... onDelete: Cascade)` a `ClienteUni`. Las tablas planas `cliente`/`calle` quedan intactas.

### Endpoints

**Clientes**
- `GET /clientes` — paginado. Query: `page`, `pageSize`, `search` (nombre/email/**ruc/cédula**), `estado`, `origen` (`interior|capital`), `tipoClienteId`, `dedupRevisar`. Incluye la **dirección principal** (para columna GPS/localidad de la lista). Respuesta `{ data: ClienteUniListItem[], total, page, pageSize }`.
- `GET /clientes/:id` — incluye `telefonos[]`, `direcciones[]`, y nombres resueltos de catálogos (tipoCliente, categoría, departamento/localidad por dirección).
- `POST /clientes` — alta **transaccional con arrays anidados**: `{ ...datos, direcciones: DireccionInput[], telefonos: TelefonoInput[] }`. Crea cliente + N direcciones + N teléfonos en una transacción Prisma. `origen` se setea `'capital'` para altas nuevas (criterio por defecto; ver Decisiones abiertas resueltas abajo). Sella `operadorAlta` con el username del JWT.
- `PATCH /clientes/:id` — edita datos de cabecera. Sella `operadorModificacion`.
- `DELETE /clientes/:id` — **baja lógica**: setea `estado='I'` (no borra). Devuelve `{ id, estado }`.

**Sub-recursos (nuevos)**
- `POST /clientes/:id/telefonos`, `PATCH /clientes/:id/telefonos/:telId`, `DELETE /clientes/:id/telefonos/:telId`.
- `POST /clientes/:id/direcciones`, `PATCH /clientes/:id/direcciones/:dirId`, `DELETE /clientes/:id/direcciones/:dirId`.
- Regla "**exactamente 1 principal**": al setear una dirección/teléfono como principal, se baja el flag de los demás del mismo cliente (en transacción). No se permite borrar el último/único, ni dejar 0 principales.

**Catálogos (read-only, cacheables)**
- `GET /catalogos/tipos-cliente` → `{id, descripcion}[]`
- `GET /catalogos/categorias-precio` → `{id, nombre}[]`
- `GET /catalogos/departamentos` → `{id, nombre}[]`
- `GET /catalogos/localidades?departamentoId=` → `{id, nombre, departamentoId}[]`
- `GET /catalogos/zonas?puestoId=` → `{id, nombre}[]`
- `GET /catalogos/puestos` → `{id, nombre}[]`

### DTOs / validación (class-validator)
- `CreateClienteDto`: `nombre` (req), `tipoClienteId?`, `categoriaPrecioId?`, `ruc?`, `cedula?`, `email?` (IsEmail opc.), `estado?` (default `'A'`), `vip?`, `observaciones?`, `observacionesComerc?`; `direcciones: DireccionInput[]` (min 1, exactamente 1 `principal`); `telefonos: TelefonoInput[]` (min 1, exactamente 1 `principal`).
- `DireccionInput`: `calle?`, `nro?`, `esquina1?`, `esquina2?`, `apto?`, `local?`, `departamentoId?`, `localidadId?`, `lat?`, `lng?`, `direccion?` (texto reconstruido), `principal` (bool), `estado?` (default `'A'`).
- `TelefonoInput`: `numero` (req), `tipo?`, `estado?` (default `'A'`), `alias?`, `principal` (bool).
- `UpdateClienteDto` = `PartialType(CreateClienteDto)` sin los arrays (los arrays se editan por sub-recurso).
- `QueryClientesDto`: agrega `origen`, `cedula` (la búsqueda libre ya cubre cédula), `dedupRevisar` (boolean), además de los existentes.

### Auth (riesgo a resolver en el plan)
El `AuthGuard` del backend debe **validar/decodificar el JWT que emite secapi** (`iss: "security-suite"`, HS256) que ahora manda el front en `Authorization: Bearer`. El plan verifica el secreto/algoritmo compartido; si no se puede verificar firma, al menos decodificar y exigir `iss` correcto + expiración. Se extrae `username` para sellar `operadorAlta`/`operadorModificacion`.

---

## Frontend

### Config
- `NEXT_PUBLIC_API_BACKEND=nestjs`.
- `axios` (`src/lib/axios.ts`) apunta al NestJS vía `NEXT_PUBLIC_NEST_URL` (p.ej. `http://192.168.x.x:3001` dev / URL prod). Mantiene `Authorization: Bearer <cookie token>`.
- Nominatim: `NEXT_PUBLIC_NOMINATIM_URL=https://nominatim.riogas.uy` (geocode + reverse).

### Tipos (`src/lib/types/cliente.ts`) — reescritos para espejar Prisma
- `Cliente` (ex `ClienteUni`): `id:number`, `origen`, `idOriginal`, `nombre`, `ruc`, `cedula`, `email`, `estado` (CHAR1), `tipoClienteId`, `categoriaPrecioId`, `vip`, `observaciones`, `observacionesComerc`, `puntosSaldo`, `fleteCobra`, `fleteCantidad`, `tipoServicioId`, `gciNro`, `fechaAlta`, `ultimaLlamada`, `dedupGrupo`, `dedupRevisar`, `direcciones: ClienteDireccion[]`, `telefonos: ClienteTelefono[]`, y campos resueltos (`tipoClienteNombre?`, `categoriaNombre?`).
- `ClienteDireccion`: `id:number`, `clienteId`, `calle`, `nro`, `esquina1`, `esquina2`, `apto`, `local`, `departamentoId`, `localidadId`, `direccion`, `lat:number|null`, `lng:number|null`, `geoFuente`, `calleMatch:boolean|null`, `principal:boolean`, `estado`.
- `ClienteTelefono`: `id:number`, `clienteId`, `numero`, `tipo`, `estado` (CHAR1), `alias`, `principal:boolean`.
- Se eliminan los enums inventados; `estado` se mapea a etiquetas en UI (`A`→Activo, `I`→Inactivo, `P`→Pendiente, `R`→…). `principal` reemplaza a `esPrincipal`; `nro` reemplaza a `nroPuerta`. IDs `number` (no uuid).
- Zod schemas alineados (create / direccion / telefono) con estas formas.

### Service (`src/services/clientes.ts`)
Se alinean firmas a IDs `number` y nuevas formas: `getClientes`, `getCliente`, `createCliente` (con arrays anidados), `updateCliente`, `deleteCliente`; `add/update/removeTelefono`, `add/update/removeDireccion`; y `getCatalogo*`. Se agrega `geocode(query)` y `reverseGeocode(lat,lng)` contra Nominatim.

### Lista (`/dashboard/clientes`)
Columnas: **Nro** (`id`) · **Origen** (badge interior/capital, reemplaza "Zona") · **Nombre** · **GPS** (`calleMatch` de la dirección principal: ✓ coincide / ✗ difiere / "s/coord" si null) · **Estado** (badge A/I/P/R) · **RUC/Cédula** · **Email** · **Localidad** (de dir. principal) · **Alta** · **Últ. llamada**. Ícono ⚠ "posible duplicado" cuando `dedupRevisar`. Filtros: estado, origen. Búsqueda (debounce) por nombre/email/ruc/**cédula**. Virtualización y paginación se conservan.

### Ficha (`/dashboard/clientes/[id]`)
- **Header:** nombre, badge estado, tipo (catálogo), badge origen, VIP, puntos; aviso "posible duplicado" si aplica. KPIs Saldo/Último pedido siguen disabled ("próximamente").
- **Tab Datos:** nombre, ruc, cédula, email, `tipoClienteId` (select 29), `categoriaPrecioId` (select), estado (select A/I/P), vip (toggle), observaciones, obs. comercial, flete. Auto-save con debounce (PATCH).
- **Tab Direcciones:** lista de tarjetas + el **mismo editor con mapa** que el alta (componente compartido). Agregar/editar/borrar (sub-endpoints), marcar principal, badge `calleMatch`, geolocalizar / tocar mapa.
- **Tab Teléfonos:** lista de filas: numero, tipo (código opcional), estado A/I, alias, radio principal. CRUD por sub-endpoint.

### Alta (`/dashboard/clientes/nuevo`) — página master-detail con mapa compartido

**Layout (workspace partido):** columna izquierda = Datos del cliente + lista de **Direcciones** (tarjetas 1..N) + lista de **Teléfonos** (filas 1..N); columna derecha = **un mapa grande** que muestra **todas** las direcciones como pines numerados. En mobile colapsa a una columna (mapa sticky arriba).

**Master-detail de direcciones:**
- Cada dirección es una tarjeta. Una está **"activa"** (en edición); las demás se muestran colapsadas en resumen (`direccion` reconstruida).
- El mapa refleja la dirección **activa**: centra y resalta su pin (arrastrable). Las otras direcciones aparecen como pines de contexto.
- **⌖ Geolocalizar** (en la tarjeta activa): geocodifica el texto escrito (Nominatim) → coloca el pin y setea `lat/lng` de esa dirección.
- **Clic/arrastre del pin**: geocodificación **inversa** (Nominatim) → completa calle/nº/localidad/departamento **de la dirección activa**. Todo queda editable.
- Badge ✓/✗ comparando la calle escrita vs. la del reverse (mismo criterio normalizado que la feature de verificación de coordenadas).
- Radio **principal** (default: la primera). `+ dirección` agrega tarjeta y la vuelve activa.

**Teléfonos:** lista de filas (numero, tipo, estado, alias) con radio principal. `+ teléfono`.

**Guardar:** un único `POST /clientes` con `{ datos, direcciones[], telefonos[] }` transaccional. Validación cliente-side (Zod): nombre requerido, ≥1 dirección, ≥1 teléfono, exactamente 1 principal de cada uno. Tras crear, redirige a la ficha del nuevo cliente.

**Facilidad de uso (requisito explícito "fácil de crear clientes"):**
- Defaults inteligentes: estado `A`, tipo `DOMESTICO`, primera dirección y primer teléfono ya principales.
- Mínimo para guardar: nombre + 1 teléfono + 1 dirección (la dirección puede guardarse solo con coordenadas del mapa si no se sabe la calle, o solo con texto sin coordenadas).
- Geolocalización en 1 clic; si falla, tocar el mapa resuelve todo.
- Atajos: Enter en "agregar teléfono"; el `+` agrega y enfoca la nueva fila/tarjeta.

**Componente compartido:** `DireccionEditor` (tarjeta + integración con el mapa de la dirección activa) y `MapaDirecciones` (mapa con N pines, pin activo editable, geocode/reverse) se usan **igual** en el alta y en la pestaña Direcciones de la ficha.

### Mapa
Leaflet (o el wrapper de mapa ya presente en el proyecto si existe; el plan lo verifica) sobre tiles propios/OSM. Pines numerados; pin activo en color distinto y arrastrable. Click en el mapa = set/mover pin activo + reverse geocode.

---

## Manejo de errores y bordes

- **Nominatim caído / sin resultado:** el alta no se bloquea; se puede guardar la dirección sin coordenadas (o con coordenadas pero sin match de calle). Se muestra aviso no intrusivo.
- **Interior sin coordenadas:** GPS "s/coord"; el usuario puede asignar coordenadas tocando el mapa.
- **Exactamente 1 principal:** forzado en backend (transacción) y en UI (radio). Borrar la principal promueve a la siguiente.
- **Borrar último teléfono/dirección:** no permitido (mensaje claro).
- **Auth inválido/expirado:** el AuthGuard responde 401; el front redirige a login (igual que el middleware).
- **Concurrencia de auto-save (Datos):** debounce + último-gana; se ignora respuesta de PATCH obsoleto.

## Testing

- **Backend (e2e/unit):** list con filtros/búsqueda/paginación; findOne con relaciones; create transaccional (arrays); regla 1-principal; sub-recursos CRUD; baja lógica; catálogos; AuthGuard acepta JWT secapi y rechaza inválido.
- **Frontend:** `npm run build` + typecheck (compila contra los nuevos tipos). Pruebas de los helpers (mapeos estado/label, normalización de calle para `calleMatch`, validación Zod del alta: ≥1 principal).
- **Manual (golden path):** listar → filtrar por origen → abrir ficha → editar Datos (auto-save) → agregar/editar/borrar dirección con geolocalización y con tocar-mapa → agregar/editar teléfono → **alta nueva** con 2 direcciones (una geolocalizada, una por mapa) + 2 teléfonos → verificar que aparece en la lista.

## Riesgos / dependencias

1. **AuthGuard ↔ JWT secapi:** secreto/algoritmo compartido para verificar firma. Si no hay secreto disponible, decodificar + validar `iss`/exp (degradado).
2. **URL del NestJS desde el front** (dev y prod) y CORS.
3. **Performance de la lista** sobre 1.13M filas: índices ya existen (`nombre`, `ruc`, `cedula`, `estado`); la búsqueda usa `contains` (ILIKE) — aceptable con paginación; el plan evalúa límite de búsqueda y `pg_trgm` si hace falta.
4. **Mapa con N direcciones** y el Nominatim propio: rate/uso aceptable (uso interno).

## Decisiones abiertas resueltas (defaults)

- **`origen` en altas nuevas:** `'capital'` (clientes nuevos se cargan en el modelo unificado como capital; el origen es trazabilidad de migración, no afecta operación). Ajustable si el usuario prefiere otro criterio.
- **`idOriginal` en altas nuevas:** se usa el `id` autoincrement como `idOriginal` placeholder hasta que exista sync (no hay CLIID de AS400 para un cliente nacido en goya).
- **Baja:** lógica (`estado='I'`), nunca física.
