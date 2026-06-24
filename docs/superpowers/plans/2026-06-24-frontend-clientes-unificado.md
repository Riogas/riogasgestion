# Módulo Clientes sobre modelo unificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el módulo de clientes (backend NestJS + frontend Next.js) opere end-to-end sobre el modelo unificado `cliente_uni` + `cliente_direccion` + `cliente_telefono` + catálogos, con alta master-detail visual (N direcciones / N teléfonos + mapa).

**Architecture:** Backend NestJS/Prisma lee/escribe `ClienteUni` con relaciones; expone CRUD + sub-recursos + catálogos; AuthGuard valida el JWT de secapi. Front pasa a modo `nestjs`, realinea tipos a Prisma, y reconstruye lista/ficha/alta. Editor de dirección+mapa compartido entre alta y ficha.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL (goya), class-validator; Next.js 16, React 19, axios, Zod, React Hook Form, Leaflet, Nominatim propio.

## Global Constraints

- `origen` de altas nuevas = `'capital'`; `idOriginal` placeholder = el `id` autoincrement (set en segundo paso del create).
- Baja = lógica (`estado='I'`), nunca física.
- Exactamente 1 `principal` por cliente en direcciones y en teléfonos (forzado en backend transaccional + UI radio).
- `estado` cliente y teléfono son CHAR(1) del AS400; el front mapea código→label.
- Interior no tiene coordenadas: `calleMatch=null` → GPS "s/coord".
- No renombrar `cliente_uni`→`cliente` ni dropear tablas planas en este plan.

## File structure

**Backend** (`backend/src/clientes/`):
- `clientes.service.ts` (modif) — CRUD sobre ClienteUni.
- `clientes.controller.ts` (modif) — rutas cliente + monta sub-controllers.
- `dto/{create,update,query}-cliente.dto.ts` (modif) + `dto/{direccion,telefono}-input.dto.ts` (nuevos).
- `telefonos.service.ts` + `telefonos.controller.ts` (nuevos).
- `direcciones.service.ts` + `direcciones.controller.ts` (nuevos).
- `clientes.module.ts` (modif).
- `backend/src/catalogos/` (nuevo módulo): `catalogos.{module,controller,service}.ts`.
- `backend/src/common/guards/auth.guard.ts` (modif) — validar JWT secapi.

**Frontend**:
- `src/lib/types/cliente.ts` (reescritura).
- `src/services/clientes.ts` (modif) + `src/services/catalogos.ts` (nuevo) + `src/services/geocode.ts` (nuevo).
- `src/lib/axios.ts` (modif, modo nestjs).
- `src/components/dashboard/clientes/ClientesList.tsx` (modif).
- `src/components/clientes/ClienteHeader.tsx`, `tabs/DatosTab.tsx`, `tabs/TelefonosTab.tsx`, `tabs/DireccionesTab.tsx` (modif).
- `src/components/clientes/MapaDirecciones.tsx` (nuevo, compartido), `DireccionEditor.tsx` (reescritura, compartido), `AddressPicker.tsx` (modif/absorbido).
- `src/app/dashboard/clientes/nuevo/page.tsx` + `src/components/clientes/AltaClienteWorkspace.tsx` (reescritura master-detail). Borrar uso de `AltaSlideOver` para alta.

---

## FASE A — Backend (NestJS sobre ClienteUni)

### Task A1: DTOs (create/update/query + inputs anidados)

**Files:**
- Modify: `backend/src/clientes/dto/query-clientes.dto.ts`
- Create: `backend/src/clientes/dto/direccion-input.dto.ts`, `backend/src/clientes/dto/telefono-input.dto.ts`
- Modify: `backend/src/clientes/dto/create-cliente.dto.ts`, `backend/src/clientes/dto/update-cliente.dto.ts`

**Interfaces — Produces:**
- `TelefonoInputDto { numero:string; tipo?:string; estado?:string; alias?:string; principal:boolean }`
- `DireccionInputDto { calle?; nro?; esquina1?; esquina2?; apto?; local?; departamentoId?:number; localidadId?:number; lat?:number; lng?:number; direccion?; principal:boolean; estado?:string }`
- `CreateClienteDto { nombre:string; tipoClienteId?:number; categoriaPrecioId?:number; ruc?; cedula?; email?; estado?; vip?:boolean; observaciones?; observacionesComerc?; direcciones:DireccionInputDto[]; telefonos:TelefonoInputDto[] }`
- `UpdateClienteDto = PartialType(OmitType(CreateClienteDto, ['direcciones','telefonos']))`
- `QueryClientesDto` añade `origen?:string`, `dedupRevisar?:boolean` a lo existente.

- [ ] **Step 1:** Crear `telefono-input.dto.ts` con class-validator (`@IsString() numero`, resto `@IsOptional()`, `@IsBoolean() principal`).
- [ ] **Step 2:** Crear `direccion-input.dto.ts` (todos `@IsOptional()` salvo `@IsBoolean() principal`; `lat/lng @IsNumber()`, `departamentoId/localidadId @IsInt()`).
- [ ] **Step 3:** Reescribir `create-cliente.dto.ts`: campos de cabecera + `@ValidateNested({each:true}) @Type(()=>DireccionInputDto) @ArrayMinSize(1) direcciones` y análogo `telefonos`.
- [ ] **Step 4:** `update-cliente.dto.ts` = `PartialType(OmitType(CreateClienteDto, ['direcciones','telefonos'] as const))`.
- [ ] **Step 5:** Añadir `origen`/`dedupRevisar` a `query-clientes.dto.ts`.
- [ ] **Step 6:** `cd backend && npx tsc --noEmit` (esperar 0 errores en `clientes/dto`). Commit: `feat(be-clientes): DTOs del modelo unificado`.

### Task A2: ClientesService sobre ClienteUni

**Files:** Modify `backend/src/clientes/clientes.service.ts`

**Interfaces — Consumes:** DTOs de A1. **Produces:** `findAll`, `findOne`, `create`, `update`, `softDelete` con `prisma.clienteUni`.

- [ ] **Step 1:** `findAll(q)`: `where` con `estado`, `origen`, `tipoClienteId`, `dedupRevisar`, y `OR` de `nombre/email/ruc/cedula` (contains, insensitive). `findMany` con `include:{ direcciones:{ where:{ principal:true }, take:1 } }`, `skip/take`, `orderBy:{ id:'asc' }`. Devolver `{data,total,page,pageSize}`.
- [ ] **Step 2:** `findOne(id)`: `findUnique` con `include:{ telefonos:true, direcciones:true }`; `NotFoundException` si null.
- [ ] **Step 3:** `create(dto, username)`: `prisma.$transaction`: validar exactamente-1-principal en arrays (helper `assertOnePrincipal`); crear `clienteUni` con `origen:'capital'`, `operadorAlta:username`, `idOriginal:0` temporal, nested `telefonos.create`/`direcciones.create`; luego `update` set `idOriginal:created.id`. Return findOne(created.id).
- [ ] **Step 4:** `update(id, dto, username)`: `findOne`; `prisma.clienteUni.update` con campos de cabecera + `operadorModificacion:username`.
- [ ] **Step 5:** `softDelete(id)`: `update estado:'I'`; return `{id, estado:'I'}`.
- [ ] **Step 6:** Helper `private assertOnePrincipal(arr, label)` → throw `BadRequestException` si `arr.filter(x=>x.principal).length !== 1`.
- [ ] **Step 7:** `npx tsc --noEmit`. Commit: `feat(be-clientes): service sobre cliente_uni con relaciones y create transaccional`.

### Task A3: Sub-recursos teléfonos y direcciones (regla 1-principal)

**Files:** Create `backend/src/clientes/telefonos.{service,controller}.ts`, `direcciones.{service,controller}.ts`; Modify `clientes.module.ts`.

**Interfaces — Produces:** rutas `POST/PATCH/DELETE /clientes/:id/telefonos[/:telId]` y `/direcciones[/:dirId]`.

- [ ] **Step 1:** `TelefonosService.add(clienteId, dto)`: si `dto.principal` → en transacción `updateMany {clienteId} set principal:false` y luego `create`. `update(telId, dto)`: idem para principal. `remove(clienteId, telId)`: impedir borrar si es el único (`count===1` → BadRequest); si era principal, promover el primero restante.
- [ ] **Step 2:** `DireccionesService` análogo sobre `clienteDireccion`.
- [ ] **Step 3:** Controllers con `@UseGuards(AuthGuard)`, `ParseIntPipe` en ids.
- [ ] **Step 4:** Registrar providers/controllers en `clientes.module.ts`.
- [ ] **Step 5:** `npx tsc --noEmit`. Commit: `feat(be-clientes): sub-recursos telefonos/direcciones con 1-principal`.

### Task A4: Módulo catálogos

**Files:** Create `backend/src/catalogos/catalogos.{module,controller,service}.ts`; Modify `backend/src/app.module.ts`.

- [ ] **Step 1:** `CatalogosService`: `tiposCliente()`→`tipoCliente.findMany({orderBy:{descripcion:'asc'}})`; `categoriasPrecio()`; `departamentos()`; `localidades(departamentoId?)`; `zonas(puestoId?)`; `puestos()`.
- [ ] **Step 2:** `CatalogosController` `@Controller('catalogos')` con los GET; `@UseGuards(AuthGuard)`.
- [ ] **Step 3:** Importar `CatalogosModule` en `app.module.ts`.
- [ ] **Step 4:** `npx tsc --noEmit`. Commit: `feat(be-catalogos): endpoints de catalogos`.

### Task A5: AuthGuard valida JWT de secapi

**Files:** Modify `backend/src/common/guards/auth.guard.ts`

- [ ] **Step 1:** Leer guard actual y `.env` para ver si hay `JWT_SECRET`/`SECAPI_JWT_SECRET`.
- [ ] **Step 2:** Si hay secreto compartido → `jwt.verify(token, secret)` (HS256). Si no → `jwt.decode` + exigir `payload.iss==='security-suite'` y `exp>now` (modo degradado, documentar). Adjuntar `req.user={username,userId,sistema}`.
- [ ] **Step 3:** Probar manualmente con el token real de jgomez (header capturado): `GET /clientes` 200 con token, 401 sin token.
- [ ] **Step 4:** Commit: `feat(be-auth): AuthGuard valida JWT secapi`.

### Task A6: Verificación de Fase A (e2e manual)

- [ ] **Step 1:** `cd backend && npm run build` (0 errores).
- [ ] **Step 2:** Levantar backend dev; con el token de jgomez: `GET /clientes?search=...&origen=interior` devuelve `{data,total}`, cada item con `direcciones[0]`.
- [ ] **Step 3:** `GET /clientes/:id` trae `telefonos[]` + `direcciones[]`. `GET /catalogos/tipos-cliente` trae 29.
- [ ] **Step 4:** `POST /clientes` con 1 dir + 1 tel crea y devuelve la ficha; `POST .../telefonos` con principal reordena. Commit si hubo ajustes.

---

## FASE B — Frontend (modo nestjs + UI unificada)

### Task B1: Tipos del front (espejo Prisma) + Zod

**Files:** Reescribir `src/lib/types/cliente.ts`

**Interfaces — Produces:** `Cliente`, `ClienteDireccion`, `ClienteTelefono` (ids number, `principal`, `nro`, `estado` CHAR1, `tipoClienteId`/`categoriaPrecioId`); `clienteSchema`, `direccionSchema`, `telefonoSchema`, `createClienteSchema` (con arrays, refine "exactamente 1 principal"); `QueryClientesParams` (+origen, +dedupRevisar); helper `estadoLabel(code)`.

- [ ] **Step 1:** Reescribir interfaces espejando schema.prisma (ver spec §Front/Tipos).
- [ ] **Step 2:** Zod: `telefonoSchema {numero,tipo?,estado=default 'A',alias?,principal=false}`; `direccionSchema {calle?,nro?,esquina1?,esquina2?,apto?,local?,departamentoId?,localidadId?,lat?,lng?,direccion?,principal=false,estado='A'}`; `createClienteSchema` extiende cabecera + `direcciones:z.array(...).min(1)` + `telefonos:...min(1)` con `.refine(a=>a.filter(x=>x.principal).length===1)` en cada uno.
- [ ] **Step 3:** `estadoLabel`/`estadoVariant` (A→Activo/green, I→Inactivo, P→Pendiente/warn, R→Revisión, default code).
- [ ] **Step 4:** `npx tsc --noEmit` (compila tipos). Commit: `feat(fe-clientes): tipos espejo del modelo unificado`.

### Task B2: Services (clientes + catálogos + geocode) y axios nestjs

**Files:** Modify `src/services/clientes.ts`, `src/lib/axios.ts`; Create `src/services/catalogos.ts`, `src/services/geocode.ts`.

- [ ] **Step 1:** `clientes.ts`: firmas con id `number`; `createCliente(dto)` postea `{...datos,direcciones,telefonos}`; sub-recursos con ids number.
- [ ] **Step 2:** `catalogos.ts`: `getTiposCliente()`, `getCategoriasPrecio()`, `getDepartamentos()`, `getLocalidades(departamentoId)`, `getZonas(puestoId?)`, `getPuestos()` (axios `api.get('/catalogos/...')`).
- [ ] **Step 3:** `geocode.ts`: `geocode(q):Promise<{lat,lng,display,calle?,localidad?,departamento?}|null>` (Nominatim `/search?format=jsonv2&q=`), `reverseGeocode(lat,lng)` (`/reverse?format=jsonv2&lat=&lon=`), parseando `address` (road, town/city, state). Base `NEXT_PUBLIC_NOMINATIM_URL`.
- [ ] **Step 4:** `axios.ts`: en modo `nestjs`, baseURL `NEXT_PUBLIC_NEST_URL`; mantener interceptor Bearer (cookie `token`).
- [ ] **Step 5:** `.env.local`/`.env.production.example`: documentar `NEXT_PUBLIC_API_BACKEND=nestjs`, `NEXT_PUBLIC_NEST_URL`, `NEXT_PUBLIC_NOMINATIM_URL`.
- [ ] **Step 6:** `npm run build` (typecheck). Commit: `feat(fe-clientes): services unificados + geocode + axios nestjs`.

### Task B3: Lista de clientes

**Files:** Modify `src/components/dashboard/clientes/ClientesList.tsx` (+ page si aplica)

- [ ] **Step 1:** Columnas: Nro(`id`), Origen(badge), Nombre, GPS(`direcciones[0].calleMatch` → ✓/✗/"s/coord"), Estado(badge via `estadoLabel`), RUC/Cédula, Email, Localidad(de dir principal), Alta(`fechaAlta`), Últ. llamada(`ultimaLlamada`). Ícono ⚠ si `dedupRevisar`.
- [ ] **Step 2:** Filtros estado/origen (selects) en la toolbar; búsqueda incluye cédula (ya server-side). Pasar `origen` en params.
- [ ] **Step 3:** Adaptar KPIs (Total server; Activos `estado==='A'`; VIP; con email).
- [ ] **Step 4:** `npm run build`. Commit: `feat(fe-clientes): lista sobre modelo unificado`.

### Task B4: Ficha — header + Datos tab

**Files:** Modify `ClienteHeader.tsx`, `tabs/DatosTab.tsx`

- [ ] **Step 1:** Header: nombre, badge estado, tipo (resuelto), badge origen, VIP, puntos; aviso "posible duplicado" si `dedupRevisar`. KPIs saldo/pedido siguen disabled.
- [ ] **Step 2:** DatosTab: campos nombre/ruc/cedula/email/observaciones/observacionesComerc + selects `tipoClienteId`(getTiposCliente)/`categoriaPrecioId`(getCategoriasPrecio)/estado(A/I/P)/vip(toggle). Auto-save debounce → `updateCliente`.
- [ ] **Step 3:** `npm run build`. Commit: `feat(fe-clientes): ficha header + datos`.

### Task B5: Mapa compartido + DireccionEditor

**Files:** Create `src/components/clientes/MapaDirecciones.tsx`; Reescribir `src/components/clientes/DireccionEditor.tsx`; absorber `AddressPicker.tsx`.

**Interfaces — Produces:**
- `MapaDirecciones({ direcciones, activeIndex, onPinMove(idx,lat,lng), onMapClick(lat,lng) })` — Leaflet, pines numerados, pin activo arrastrable, click → onMapClick.
- `DireccionEditor({ value, onChange, onGeolocate, calleMatch })` — tarjeta editable de una dirección; botón ⌖ Geolocalizar.

- [ ] **Step 1:** `MapaDirecciones`: cargar Leaflet dinámico (`next/dynamic`, ssr:false). Pines por dirección con lat/lng; activo distinto color + `draggable`; `onMapClick`→reverse en el padre.
- [ ] **Step 2:** `DireccionEditor`: inputs calle/nro/esquinas/apto/local + selects depto/localidad (catálogos); botón Geolocalizar → `geocode(texto)`; badge `calleMatch` (compara calle escrita vs reverse, normalizando con la misma función del feature de coordenadas).
- [ ] **Step 3:** Helper `normalizeCalle` + `calcCalleMatch(escrita, geo)` en `src/lib/clientes/calle.ts` (reutiliza criterio del backfill).
- [ ] **Step 4:** `npm run build`. Commit: `feat(fe-clientes): mapa compartido + editor de direccion`.

### Task B6: Tabs Direcciones y Teléfonos (ficha)

**Files:** Modify `tabs/DireccionesTab.tsx`, `tabs/TelefonosTab.tsx`

- [ ] **Step 1:** DireccionesTab: lista de `DireccionEditor` + `MapaDirecciones` (activeIndex local); CRUD via `add/update/removeDireccion`; radio principal.
- [ ] **Step 2:** TelefonosTab: filas numero/tipo/estado(A/I)/alias + radio principal; CRUD via sub-recurso.
- [ ] **Step 3:** `npm run build`. Commit: `feat(fe-clientes): tabs direcciones y telefonos`.

### Task B7: Alta master-detail (página completa)

**Files:** Reescribir `src/app/dashboard/clientes/nuevo/page.tsx`; Create `src/components/clientes/AltaClienteWorkspace.tsx`. Quitar uso de `AltaSlideOver` en la lista (el "+ Nuevo" navega a `/dashboard/clientes/nuevo`).

- [ ] **Step 1:** `AltaClienteWorkspace`: RHF con `createClienteSchema`; `useFieldArray` para `direcciones` y `telefonos`. Layout 2 columnas (form izq / `MapaDirecciones` der), responsive a 1 col.
- [ ] **Step 2:** Estado `activeDirIndex`; cada `DireccionEditor` setea activo al enfocar; geocode rellena la dir activa; `MapaDirecciones.onMapClick`→`reverseGeocode`→set fields de la dir activa.
- [ ] **Step 3:** Radios principal (dir y tel), defaults (estado A, tipo DOMESTICO=1, primera dir/tel principal). `+ dirección`/`+ teléfono` agregan y enfocan.
- [ ] **Step 4:** Submit → `createCliente` → redirect `/dashboard/clientes/[id]`. Validación visible (≥1 dir, ≥1 tel, 1 principal c/u).
- [ ] **Step 5:** Quitar import/uso de `AltaSlideOver` para alta en `ClientesList.tsx`.
- [ ] **Step 6:** `npm run build`. Commit: `feat(fe-clientes): alta master-detail con mapa`.

### Task B8: Verificación final (golden path)

- [ ] **Step 1:** `npm run build` raíz OK; backend `npm run build` OK.
- [ ] **Step 2:** Manual: listar → filtrar origen → ficha → editar Datos → agregar/editar/borrar dirección (geolocalizar + tocar mapa) → agregar teléfono → alta nueva con 2 dir (1 geo, 1 por mapa) + 2 tel → aparece en lista.
- [ ] **Step 3:** Commit final si hubo ajustes + push `dev`.

---

## Self-Review

- **Cobertura del spec:** backend (service/sub-recursos/catálogos/auth) → A1–A6; tipos/services/axios → B1–B2; lista → B3; ficha → B4/B6; alta master-detail + mapa compartido → B5/B7. ✓
- **Consistencia de tipos:** `principal`/`nro`/ids `number`/`estado` CHAR1 usados igual en back (Prisma) y front (B1). ✓
- **Riesgos:** AuthGuard secapi (A5) — degradado si no hay secreto; URL NestJS (B2); interior sin coords (manejado en lista/editor).
