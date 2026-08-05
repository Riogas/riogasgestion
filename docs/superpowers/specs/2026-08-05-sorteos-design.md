# Sorteos — Design Doc

**Fecha:** 2026-08-05
**Estado:** Aprobado por el usuario (brainstorming completo)
**Alcance:** Módulo "Sorteos" en Goya: admin con login para crear sorteos y generar QRs masivos + página pública sin login donde el participante escanea, completa sus datos y sabe al instante si ganó.

---

## 1. Resumen

RioGas imprime lotes de QRs con códigos únicos (stickers en garrafas, folletos, etc.). Una persona escanea el QR con su celular, llega a una página pública de Goya (sin login), completa nombre, teléfono, edad y email (opcional), confirma, y ve una pantalla animada: **"¡Ganaste!"** (con código de canje) o **"Seguí participando"**. El premio se define en el momento de confirmar mediante **momentos ganadores** repartidos en la ventana del sorteo. Todo queda registrado en tablas nuevas de la base goya, incluyendo datos invisibles del dispositivo y la ubicación inferida.

### Decisiones tomadas (respuestas del usuario)

| Decisión | Elección |
|---|---|
| Cuándo se define el ganador | Al confirmar el formulario (no pre-asignado al QR) |
| Reparto de premios | **Momentos ganadores**: K instantes aleatorios entre fecha-desde y fecha-hasta; la primera confirmación válida después de cada instante gana |
| Canje | Código de canje único en pantalla + "RioGas te va a contactar"; gestión de entrega desde el admin |
| Exposición | Goya ya es accesible desde internet — el QR apunta directo |
| Geo | Híbrido: geo por IP siempre (invisible) + GPS opcional con permiso del navegador, resuelto server-side contra Nominatim propio |
| Formato de impresión | **ZIP de PNGs individuales** (1024px, un archivo por código) |
| Reglas por persona | Varias chances (1 por QR), pero **máximo 1 premio por teléfono por sorteo** |
| Código visible en URL | **No**: `/sorteo/<codigo>` redirige a `/sorteo` con cookie httpOnly; el código nunca se ve en la barra ni llega al JS del cliente |
| Arquitectura | Enfoque A: módulo Nest blindado + route handlers dedicados de Next con API key interna |

---

## 2. Arquitectura

```
[QR impreso] → https://<goya>/sorteo/<codigo>
                    │ (route handler: valida forma del código, setea cookie httpOnly efímera, 302)
                    ▼
              /sorteo  (página pública, URL limpia, fuera de /dashboard)
                    │ fetch
                    ▼
     /api/sorteo-publico/estado | /api/sorteo-publico/participar   (route handlers Next dedicados)
                    │ + x-api-key interna (env), whitelist de operaciones
                    ▼
     NestJS backend — SorteosPublicoController (SorteoApiKeyGuard + Throttler)
     NestJS backend — SorteosAdminController (AuthGuard)  ← /dashboard/sorteos vía catch-all /api existente
                    │
                    ▼
              Prisma → Postgres goya (5 tablas nuevas)
```

- **Admin** usa la cadena estándar del repo: componente → hook react-query (`src/hooks/sorteos/`) → service (`src/services/sorteos.ts`, axios `baseURL:"/api"`) → catch-all `src/app/api/[...path]/route.ts` → Nest.
- **Público** NO pasa por el catch-all: route handlers dedicados que solo permiten 2 operaciones y agregan la API key interna (patrón `SyncApiKeyGuard` de `backend/src/zonas/zonas.controller.ts`, `timingSafeEqual`).
- El middleware `src/proxy.ts` agrega excepción pública: `pathname === '/sorteo' || pathname.startsWith('/sorteo/')`.

## 3. Modelo de datos (Prisma, convenciones del repo: modelo PascalCase español, `@@map` snake_case)

### `Sorteo` → `sorteo`
- `id` autoincrement PK
- `nombre` VarChar(120), `descripcion` VarChar(500)?
- `premioDescripcion` VarChar(300) — qué se gana
- `fechaDesde` DateTime, `fechaHasta` DateTime
- `cantidadPremios` Int
- `maxRegistrosDispositivoDia` Int @default(1) — la "X" configurable
- `edadMinima` Int @default(18)
- `estado` VarChar(20): `borrador` | `activo` | `finalizado` | `cancelado`
- `createdAt`, `updatedAt`

### `SorteoLote` → `sorteo_lote`
- `id`, `sorteoId` FK, `cantidad` Int, `generadoPor` VarChar(80)?, `createdAt`

### `SorteoCodigo` → `sorteo_codigo`
- `id`, `sorteoId` FK, `loteId` FK
- `codigo` VarChar(16) **@unique global** — 12 chars Base32 crypto-random sin ambiguos (alfabeto de `src/lib/routeCode.ts`; ~60 bits, inadivinable)
- `estado` VarChar(15): `disponible` | `usado`
- `usadoAt` DateTime?
- Índices: `@@index([sorteoId, estado])`

### `SorteoMomentoGanador` → `sorteo_momento_ganador`
- `id`, `sorteoId` FK
- `fechaMomento` DateTime — instante aleatorio dentro de [fechaDesde, fechaHasta]
- `participacionId` Int? @unique — null = premio no reclamado todavía
- Índice: `@@index([sorteoId, fechaMomento])`

### `SorteoParticipacion` → `sorteo_participacion`
- `id`, `sorteoId` FK, `codigoId` FK **@unique** (un código = una participación)
- **Visibles:** `nombre` VarChar(120), `telefono` VarChar(20), `edad` Int, `email` VarChar(120)?
- **Resultado:** `ganador` Boolean @default(false), `codigoCanje` VarChar(12)? @unique, `premioEntregado` Boolean @default(false), `premioEntregadoAt` DateTime?
- **Invisibles (dispositivo):** `deviceId` VarChar(40), `fingerprint` VarChar(64)?, `userAgent` VarChar(500)?, `ip` VarChar(45)?, `idioma` VarChar(10)?, `plataforma` VarChar(60)?, `resolucion` VarChar(20)?
- **Invisibles (geo):** `ipPais` / `ipRegion` / `ipCiudad` VarChar?, `gpsLat` / `gpsLng` Decimal?, `gpsPais` / `gpsDepartamento` / `gpsLocalidad` VarChar? (reverse Nominatim server-side), `geoFuente` VarChar(10)? (`ip` | `gps`)
- `createdAt`
- Índices: `@@index([sorteoId, telefono])`, `@@index([sorteoId, deviceId, createdAt])`

**Migración:** flujo del repo = `prisma db push` (`npm run prisma:push` + `prisma:generate`). No hay carpeta migrations.

## 4. Mecánica del sorteo

### Activación
Al pasar un sorteo a `activo` se generan `cantidadPremios` momentos ganadores: timestamps aleatorios uniformes en [fechaDesde, fechaHasta]. Si se editan fechas o cantidad con el sorteo activo, se regeneran **solo los momentos pendientes** (los ya asignados no se tocan).

### Confirmación (una transacción Prisma)
1. **Código válido:** existe, `estado=disponible`, sorteo `activo`, `now` dentro de [fechaDesde, fechaHasta].
2. **Límite dispositivo:** count de participaciones del `deviceId` en ese sorteo en el día calendario **America/Montevideo** < `maxRegistrosDispositivoDia`.
3. Crear `SorteoParticipacion` + marcar código `usado` (update condicional `WHERE estado='disponible'` — si afecta 0 filas, el código ya fue usado en una carrera → rechazar).
4. **Sorteo:** tomar el momento ganador pendiente más antiguo con `fechaMomento <= now`:
   - Si existe **y** el teléfono no tiene otra participación ganadora en este sorteo → **gana**: claim atómico del momento (`UPDATE ... SET participacion_id = X WHERE id = ? AND participacion_id IS NULL`; si afecta 0 filas, otro lo ganó en la carrera → sigue participando), generar `codigoCanje` (8 chars Base32).
   - Si no → **"seguí participando"**.
5. Si el teléfono ya ganó, **no consume** el momento: queda para la siguiente confirmación válida.

**Propiedades:** premios repartidos en toda la campaña; momentos vencidos sin reclamar se acumulan y los toman las siguientes confirmaciones (1 por confirmación); nunca dos ganadores por el mismo momento; máximo `cantidadPremios` ganadores.

## 5. Flujo público

### Entrada `/sorteo/[codigo]` (route handler, no página)
- Valida la **forma** del código (regex del alfabeto, largo) sin tocar la DB.
- Setea cookie **httpOnly, Secure, SameSite=Lax**, TTL 2 horas, con el código.
- `302` a `/sorteo`. El código no aparece nunca en la barra de direcciones ni es accesible desde el JS del cliente. (El QR impreso sí contiene la URL completa — es lo que codifica; eso es inevitable y aceptado.)

### Página `/sorteo` (`src/app/sorteo/page.tsx`, fuera de /dashboard, sin Sidebar/Navbar)
1. Al montar llama a `/api/sorteo-publico/estado` (la cookie viaja sola). Respuestas: `ok` (muestra form + nombre del sorteo), `sin_cookie` ("volvé a escanear el QR"), `usado`, `no_iniciado`, `finalizado`, `invalido` — cada una con su pantalla estilizada.
2. **Captura invisible en paralelo:** `deviceId` (UUID en cookie httpOnly de larga duración — 1 año — que el handler de `/api/sorteo-publico/estado` setea si no existe; el cliente nunca la lee), fingerprint best-effort (hash SHA-256 de userAgent+idioma+resolución+timezone+canvas, sin librería externa), userAgent/idioma/plataforma/resolución, e intento de `navigator.geolocation` (si el usuario acepta el cartel del navegador se mandan lat/lng; si rechaza, no pasa nada).
3. **Form (react-hook-form + zod):** nombre (requerido), teléfono uruguayo (requerido, normalizado a `09XXXXXXX` / `2XXXXXXX`), edad (requerida, ≥ `edadMinima` del sorteo, ≤ 120), email (opcional, formato). Honeypot oculto + timestamp de render (si el submit llega en < 3 s o con honeypot lleno → se responde "seguí participando" sin registrar).
4. **Submit** → `/api/sorteo-publico/participar` → resultado.
5. **Server-side en Nest:** geo por IP con `geoip-lite` (lookup local, sin llamadas externas; IP real desde `x-forwarded-for`) y, si vinieron lat/lng, reverse geocode contra `https://nominatim.riogas.uy` (timeout corto, no-fatal: si falla, quedan las coordenadas crudas).

### Pantallas de resultado
- **Ganó:** confetti (canvas propio liviano o `canvas-confetti`) + card héroe gradiente azul→naranja + código de canje en tipografía enorme + "Guardá este código. RioGas te va a contactar al <teléfono>."
- **Seguí participando:** animación empática con la llama RioGas + mensaje cálido ("Esta vez no fue, ¡seguí participando!").
- Ambas respetan `prefers-reduced-motion`.

## 6. Admin `/dashboard/sorteos`

**Menú:** alta en secapi (app GOYA id 3): item `path=/dashboard/sorteos`, permiso `ObjetoKey=sorteos` / `AccionKey=view`. Ícono existente en `iconMap.ts` (ej. `Gift` de lucide — agregar al mapa si falta). **Prerequisito de deploy, documentado en el plan.**

**Página** (patrón Clientes: `page.tsx` con `PageHeader` + `Suspense` + componente en `src/components/dashboard/sorteos/`):
- **Lista:** TableCard + filtros nuqs + react-query; columnas: nombre, badge estado, fechas, progreso premios entregados/total, participaciones. Botón "Nuevo sorteo" (dialog con form zod).
- **Detalle `/dashboard/sorteos/[id]`** con tabs (patrón ClienteTabs, tab en URL):
  - **Resumen:** KPIs bento (participaciones, ganadores, premios pendientes, códigos usados/total) + gráfica participaciones por día (recharts) + distribución por departamento (datos geo).
  - **Códigos:** lista de lotes, botón "Generar lote" (cantidad, tope 10.000 por lote), descarga ZIP por lote, contadores.
  - **Participantes:** tabla filtrable/paginada con export CSV (datos visibles + geo + dispositivo).
  - **Ganadores:** nombre, teléfono, código de canje, fecha, botón "Marcar premio entregado".
  - **Configuración:** editar sorteo, cambiar estado (activar/finalizar/cancelar) con confirmación.

**Generación de lote (Nest):** `$transaction` + `createMany` (patrón `moviles.service.ts`); códigos generados con `crypto.randomBytes` → Base32; colisión (probabilísticamente nula) manejada con retry.
**ZIP (Nest, streaming):** `qrcode` (PNG 1024px, margen amplio, error correction M) + `archiver` pipeado a la response; cada archivo `<codigo>.png` con la URL completa `https://<PUBLIC_BASE_URL>/sorteo/<codigo>`. `PUBLIC_BASE_URL` por env.

## 7. Seguridad

1. **Superficie mínima:** solo 2 endpoints públicos, detrás de route handlers Next dedicados con whitelist + `x-api-key` interna (`SORTEOS_PUBLIC_API_KEY` en env de ambos lados, comparación `timingSafeEqual`). El catch-all y el resto del backend no cambian.
2. **Rate limiting:** `@nestjs/throttler` en el controller público (ej. 10 req/min por IP) — además del límite de negocio X/dispositivo/día y 1 premio/teléfono/sorteo.
3. **Códigos:** 12 chars Base32 (~60 bits), single-use, unique global; código de canje 8 chars.
4. **Cookie httpOnly** para el código (nunca en URL visible ni en JS).
5. **Anti-bot:** honeypot + tiempo mínimo de llenado; sin CAPTCHA (fricción innecesaria para "controles mínimos").
6. **Sin filtración de información:** las respuestas públicas nunca revelan stock de premios, momentos, ni si un teléfono ya ganó (el "seguí participando" es indistinguible).
7. Validación server-side completa (class-validator, ValidationPipe global whitelist ya configurado).

## 8. Dependencias nuevas

| Paquete | Dónde | Para |
|---|---|---|
| `qrcode` | backend | PNGs de QR |
| `archiver` | backend | ZIP streaming |
| `@nestjs/throttler` | backend | rate limit por IP |
| `geoip-lite` | backend | geo por IP local |
| `canvas-confetti` | front | animación de ganador (o canvas propio si se prefiere cero deps) |

Sin librería de fingerprint (hash propio best-effort). Sin librería de PDF (se eligió ZIP de PNGs).

## 9. Testing

- **Unit (Nest):** generación de códigos (unicidad, alfabeto), activación (K momentos dentro del rango), confirmación (código usado, fuera de fecha, límite dispositivo, honeypot), mecánica de momentos (vencidos acumulados, 1 premio por teléfono, claim atómico simulando carrera), regeneración de momentos al editar.
- **E2E (Playwright, ya configurado):** flujo público completo con cookie (escaneo simulado → redirect → form → resultado), pantallas de error (usado/finalizado), flujo admin (crear sorteo, generar lote, ver participante).
- **Manual:** QR real impreso escaneado con un celular contra el ambiente de dev.

## 10. Fuera de alcance (v1)

- Notificación automática al ganador (SMS/WhatsApp) — el contacto es manual desde la lista de ganadores.
- Múltiples tipos/niveles de premio por sorteo (un solo premio configurado por sorteo).
- CAPTCHA y device-attestation fuerte — los controles son best-effort por decisión explícita ("controles mínimos").
- PDF de impresión con layout de etiquetas (se eligió ZIP de PNGs).
- Panel público de resultados / listado de ganadores.

## 11. Riesgos y gotchas conocidos

- **Alta en secapi es prerequisito** para ver el menú y pasar el middleware en `/dashboard/sorteos`.
- Params de hooks react-query deben ir **memoizados** (gotcha documentado en `useClientes.ts` — refetch infinito).
- En el server de deploy el puerto 3001 lo usa secapi; goya-backend corre en otro puerto (config existente, no tocar).
- `geoip-lite` con IPs móviles uruguayas puede dar solo país/ciudad aproximada — por eso el GPS opcional.
- La página pública debe funcionar bien en WebViews de lectores de QR (Instagram/cámara) — evitar features que fallen ahí (no depender de localStorage para lo crítico; la cookie es la fuente de verdad).
