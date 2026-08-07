# Sorteos — Checklist de puesta en producción

**Fecha:** 2026-08-05
**Referencia:** `docs/superpowers/specs/2026-08-05-sorteos-design.md`
**Estado:** pendiente de ejecutar (nada de esto se hizo todavía; el módulo solo fue validado en dev)

Este documento es el checklist operativo para deployar el módulo Sorteos. No repite el diseño (ver el
design doc), solo lo que hay que **hacer** en el ambiente de producción.

---

## 1. Alta en secapi (app GOYA, id 3)

Sin esto el menú no aparece y el middleware (`src/proxy.ts`) bloquea `/dashboard/sorteos` con 401/redirect
a `/no-autorizado`, aunque el resto del deploy esté OK.

1. Item de menú:
   - `path = /dashboard/sorteos`
   - Ícono `gift` (ya existe en `src/components/dashboard/iconMap.ts:236`, mapea a `Gift` de lucide — no
     hace falta tocar código).
2. Permiso:
   - `ObjetoKey = sorteos`
   - `AccionKey = view`
   - Asignar a los roles que deban ver el módulo (mínimo: administradores).
3. **Detalle `/dashboard/sorteos/[id]`:** el middleware calcula el `ObjetoKey` a partir del **último
   segmento** de la ruta (`getObjetoKey()` en `src/proxy.ts:44-48`). Para `/dashboard/sorteos/12` ese
   último segmento es `12` (el id), no `sorteos`, y no va a matchear ningún objeto por key. El middleware
   ya manda también `ObjetoPath: pathname` en el body a secapi (`src/proxy.ts:159-174`) precisamente para
   que secapi resuelva rutas dinámicas por patrón — es el mismo mecanismo que ya funciona hoy para
   `/dashboard/clientes/[id]` y `/dashboard/moviles/[id]`. **Verificar en secapi que exista la regla de
   patrón para `/sorteos/:id`** (o el equivalente que ya tengan cargado para clientes/móviles) antes de
   dar por buena el alta — si falta, el detalle del sorteo va a redirigir a `/no-autorizado` aunque la
   lista funcione.

---

## 2. Variables de entorno

### 2.0 `JWT_SECRET` — riesgo abierto, cerrarlo requiere el secreto de secapi ⚠

Goya **nunca verificó la firma de los JWT**: el token lo emite secapi y el backend NestJS solo lo
decodifica. Mientras `JWT_SECRET` no esté configurada, cualquiera que alcance el backend arma un
payload base64 y entra — y detrás de esos endpoints hay PII de consumidores finales (nombre,
teléfono, email, IP, GPS — Ley 18.331), el control de entrega de premios y la lista completa de
códigos de un lote.

Estado actual del guard (`backend/src/common/guards/auth.guard.ts`):

| Situación | Comportamiento |
|---|---|
| `JWT_SECRET` configurada | Verifica la firma HMAC-SHA256. Un token que no venga en 3 partes se rechaza. |
| Sin `JWT_SECRET` | **Sigue autenticando** (comportamiento histórico) y avisa por log, una vez por proceso. |
| Sin `JWT_SECRET` + `AUTH_REQUIRE_JWT_SECRET=1` | Falla cerrado: 401 en todos los endpoints autenticados. |

**El cierre es opt-in a propósito.** Una versión anterior lo deducía de `NODE_ENV` y tumbó la API
entera del ambiente que corría con `NODE_ENV=production` sin secreto (PM2): todos los endpoints,
no solo Sorteos, devolvieron `401 Autenticación no disponible`. Deducirlo del ambiente no es
seguro cuando el comportamiento histórico era permisivo.

**Cómo cerrar el riesgo de verdad** (no se puede hacer solo desde este repo):
1. Averiguar con qué algoritmo y secreto firma secapi los JWT (si no es HS256, el guard necesita
   otro verificador — p. ej. clave pública si fuera RS256).
2. Setear ese mismo secreto en `JWT_SECRET` del backend. Si no coincide, los tokens legítimos
   pasan a rebotar con "Firma inválida" y se cae el login de toda la app.
3. Recién ahí, agregar `AUTH_REQUIRE_JWT_SECRET=1` para que un deploy futuro sin la variable falle
   ruidosamente en vez de quedar permisivo en silencio.

| Variable | Valor | Nota |
|---|---|---|
| `JWT_SECRET` | el mismo secreto con el que secapi firma los JWT (HS256) | Opcional hoy; sin ella no se verifica ninguna firma. |
| `AUTH_REQUIRE_JWT_SECRET` | `1` | Opt-in. **Activar solo después** de confirmar que `JWT_SECRET` es la correcta. |

Verificación después del deploy: con sesión válida, `GET /api/sorteos` debe responder 200. Con
`JWT_SECRET` correcta, un token inventado (`Authorization: Bearer x.eyJzdWIiOiJhIn0.x`) debe
responder 401.

### Backend (`backend/.env` en el server de prod, o el mecanismo de envs que use el deploy)

| Variable | Valor | Nota |
|---|---|---|
| `SORTEOS_PUBLIC_API_KEY` | hex de 32+ caracteres (ej. `openssl rand -hex 16` → 32 chars) | **Debe ser idéntica** a la del front. Ver placeholder documentado en `.env.production.example` raíz. |
| `SORTEOS_PUBLIC_BASE_URL` | URL pública real del sitio, ej. `https://goya.riogas.com.uy` (sin barra final) | **Obligatoria.** El backend responde **500 a propósito** en el endpoint de descarga del ZIP si esta env no está seteada (decisión tomada en Task 6 tras el fix round 1 — antes salía con default `localhost:3000`, lo cual generaba QRs rotos en producción sin avisar). |
| `NOMINATIM_URL` | opcional, default `https://nominatim.riogas.uy` | Solo afecta el reverse geocode de GPS opcional; si falla, no es fatal (quedan lat/lng crudas). |

### Front (Next, envs del build/runtime del front)

| Variable | Valor | Nota |
|---|---|---|
| `SORTEOS_PUBLIC_API_KEY` | **la misma** que la del backend | La usan los route handlers `src/app/api/sorteo-publico/*` para autenticarse contra el backend. |

El único `.env.example` versionado en el repo es `.env.production.example` (raíz) — ahí ya está el
placeholder `SORTEOS_PUBLIC_API_KEY=CAMBIAR_API_KEY_SORTEOS` documentado (línea ~106). `backend/.env.example`
existe pero está gitignoreado (no se commitea), así que no sirve como referencia fuera de la máquina donde
se generó.

**Puerto:** ojo con el puerto real del front en producción al armar `SORTEOS_PUBLIC_BASE_URL` — en dev el
front corre en `:4000` (no `:3000`), verificar cuál es el puerto/dominio público real antes de generar el
primer lote de QRs.

---

## 3. Base de datos

```
prisma db push
prisma generate
```

en el server de prod, contra la base `goya`. Las tablas nuevas son **aditivas** (no tocan tablas
existentes): `sorteo`, `sorteo_lote`, `sorteo_codigo`, `sorteo_momento_ganador`, `sorteo_participacion`.
No hay carpeta `migrations` en este repo — el flujo estándar ya es `db push` (ver design doc §3).

---

## 4. Node del backend

El backend debe correr con **Node ≥ 20**. Las versiones de las dos dependencias nuevas que tienen
constraints de engine se fijaron pensando en esto:

- `archiver@^7.0.1` (CJS, no ESM — evita el requisito de Node ≥ 20.19 que tenía la v8)
- `geoip-lite@^1.4.x` (la v2.0.3 pide Node ≥ 24, se bajó a 1.4.x adrede — ver progress.md Task 2/5)

Si el server de prod corre una versión de Node distinta a la de dev/staging, revalidar que ambos paquetes
instalen y arranquen sin warnings de engine.

---

## 5. Verificaciones post-deploy

1. **Acceso público real:** desde un celular con datos móviles (no wifi de oficina, para probar NAT/firewall
   real), abrir `https://<dominio>/sorteo/CODIGOPRUEBA1` (un código que no exista). Debe redirigir a
   `/sorteo` mostrando la pantalla de "escaneá el QR para participar" (estado `sin_cookie`/`invalido`), no
   un error de servidor ni un timeout.
2. **Proxy / nginx:**
   - Debe reenviar `x-forwarded-for` con la IP real del cliente. El rate limit del `@nestjs/throttler` del
     controller público cuenta por IP; si todo el tráfico le llega al backend con la IP del proxy, el
     límite (10 req/min) se convierte en un balde global compartido por todos los usuarios y el sorteo se
     bloquea solo con tráfico normal.
   - `/sorteo` (y `/sorteo/[codigo]`) debe servirse por **HTTPS** — la cookie del código y la cookie de
     `deviceId` se setean `Secure`, así que por HTTP el navegador las descarta silenciosamente y el flujo
     se rompe (queda siempre en `sin_cookie`).
3. **Prueba end-to-end real:** crear un sorteo de prueba desde el admin (estado borrador → activar), generar
   un lote de 2 códigos, descargar el ZIP, escanear uno de los dos QR con un celular real y completar el
   formulario. Confirmar que la participación quede en `sorteo_participacion` y que, si activás el sorteo
   con `fechaHasta` muy cercana (ver §6), alguna de las dos participaciones gane.
4. **Auth:** ver §2.0 (200 con sesión real, 401 con token inventado).
5. **Descarga de códigos:** el backend genera **un solo ZIP a la vez por proceso**; una segunda descarga
   simultánea responde 429 ("Ya hay una descarga de códigos generándose"). Es a propósito: cada código es
   un PNG de 1024px encodeado en el hilo principal y un lote de 10.000 son minutos de CPU. Si hay que
   preparar varios lotes, descargarlos de a uno.

---

## 6. Operativa (flujo típico de uso)

1. **Crear** el sorteo en `/dashboard/sorteos` (queda en estado `borrador`, no genera nada todavía).
2. **Activar**: recién ahí se generan los `cantidadPremios` momentos ganadores dentro de la ventana
   `[fechaDesde, fechaHasta]` (ver nota en el design doc §4 sobre `max(now, fechaDesde)` — si se activa
   tarde, los premios se reparten en el tiempo que queda, no en toda la ventana original).
3. **Generar lote** de códigos (tope 10.000 por lote).
4. **Descargar ZIP**: los QR se generan en ese momento con la URL `https://<SORTEOS_PUBLIC_BASE_URL>/sorteo/<codigo>`.
   Si se cambia `SORTEOS_PUBLIC_BASE_URL` después, hay que **regenerar el ZIP** (los códigos ya
   descargados en PNGs viejos siguen apuntando a la URL vieja — los códigos en sí no cambian, solo la URL
   impresa en el QR).
5. **Imprimir** los PNGs del ZIP (stickers, folletos, etc.).
