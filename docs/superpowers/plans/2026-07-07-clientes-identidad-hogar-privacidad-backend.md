# Clientes: identidad + hogar + cobertura + privacidad (Backend & Datos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir sobre `cliente_uni` la capa de identidad única (Persona), hogar (M:N), afiliación cliente↔distribuidor (Cobertura), el workbench de deduplicación y el scoping por rol (call center vs distribuidor), a nivel schema + datos + backend NestJS.

**Architecture:** Modelo *party*: los registros crudos (`cliente_uni`) se conservan intactos y apuntan a una `persona` curada. El motor de sugerencias (Python) puebla `match_sugerencia`; el backend NestJS expone workbench (unificar/hogar/undo), la vista 360 y el servicio de identificación que devuelve un DTO **redactado** según rol+afiliación. La normalización de dirección se define una vez (vectores de test compartidos) e se implementa en TS (runtime) y Python (backfill).

**Tech Stack:** PostgreSQL (goya 192.168.2.117), Prisma, NestJS 11, Jest (ts-jest), Python 3 + psycopg2 + rapidfuzz.

## Global Constraints

- Backend NestJS: prefijo global `api`, `AuthGuard` en controllers, `PrismaService` inyectado. Puerto por `.env` (NO 3001 en goya-dev; 3001 lo usa secapi).
- Prisma: los modelos usan `@@map` a snake_case; nombres de índice explícitos para que `prisma db push` no los recree.
- Lo crudo (`cliente_uni`, `cliente_telefono`, `cliente_direccion`) **nunca se destruye**; toda unificación es **reversible**.
- ETLs Python: credenciales SOLO vía `_creds.py` (lee `backend/.env`), idempotentes, en `backend/prisma/`.
- Identificación de distribuidor = **lookup por identificador exacto**, nunca listado/búsqueda parcial.
- `HOGAR_PROXIMIDAD_METROS` (default 25) y la tabla de abreviaturas de vía = **configurables** (env), no hardcodeadas.
- Rol y `empresaFleteraId` del usuario llegan desde secapi en `req.user`.
- Tests: `cd backend && npm test` (Jest). Commits frecuentes, uno por task.

---

## File Structure

**Schema / migración:**
- Modify: `backend/prisma/schema.prisma` (nuevos modelos + campos)
- Create: `backend/prisma/sql/2026-07-07_persona_cedula_unique.sql` (índice único parcial)

**Normalización (compartida):**
- Create: `backend/src/common/direccion/normalize-direccion.ts` (runtime TS)
- Create: `backend/src/common/direccion/normalize-direccion.spec.ts`
- Create: `backend/prisma/_fixtures/direccion_vectors.json` (vectores compartidos TS↔Python)
- Create: `backend/prisma/_normdir.py` (mirror Python)

**ETLs / backfill (Python, `backend/prisma/`):**
- Create: `etl_persona_de_uno.py`, `etl_sugerencias.py`

**Backend NestJS (`backend/src/`):**
- Create: `personas/{personas.module,personas.service,personas.controller}.ts` + `dto/`
- Create: `workbench/{workbench.module,workbench.service,workbench.controller}.ts` + `dto/`
- Create: `cobertura/{cobertura.module,cobertura.service}.ts`
- Create: `identificacion/{identificacion.module,identificacion.service,identificacion.controller}.ts` + `dto/` + `redaccion.ts` (+ specs)
- Modify: `app.module.ts` (registrar módulos)

---

## Phase 0 — Schema & migración

### Task 0.1: Modelos Prisma nuevos + campos

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: modelos `Persona`, `Hogar`, `HogarMiembro`, `MatchSugerencia`, `Cobertura`; campos `ClienteUni.personaId`, `ClienteTelefono.ultFecha`, `ClienteDireccion.ultFecha`/`territorioPuestoId`/`direccionTextoNorm`.

- [ ] **Step 1:** Agregar a `schema.prisma` los 5 modelos nuevos exactamente como en el spec §4.2 (`persona`, `hogar`, `hogar_miembro`, `match_sugerencia`, `cobertura`), con sus `@@map`/índices. En `Persona` NO poner `@@unique([cedula])` de Prisma (se hace por SQL parcial en 0.2); dejar solo `@@index([cedula])`.
- [ ] **Step 2:** Agregar campos a modelos existentes:
  - `ClienteUni`: `personaId Int?` + relación `persona Persona? @relation(fields:[personaId], references:[id])` + `@@index([personaId])`.
  - `ClienteTelefono`: `ultFecha DateTime?` + back-relation `personaPrincipalDe Persona[] @relation("PersonaTelPrincipal")`.
  - `ClienteDireccion`: `ultFecha DateTime?`, `territorioPuestoId Int?`, `direccionTextoNorm String? @db.VarChar(300)` + `@@index([direccionTextoNorm])` + back-relation `personaPrincipalDe Persona[] @relation("PersonaDirPrincipal")`.
- [ ] **Step 3:** Validar: `cd backend && npx prisma validate`. Expected: `The schema is valid`.
- [ ] **Step 4:** Generar cliente: `npx prisma generate`. Expected: `Generated Prisma Client`.
- [ ] **Step 5:** Commit: `git add backend/prisma/schema.prisma && git commit -m "feat(schema): persona, hogar, cobertura, match_sugerencia + campos ultFecha/personaId"`

### Task 0.2: Índice único parcial de cédula + push

**Files:**
- Create: `backend/prisma/sql/2026-07-07_persona_cedula_unique.sql`

- [ ] **Step 1:** Escribir el SQL:
```sql
-- Cédula única SOLO cuando no es null (Prisma no expresa índices parciales).
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_cedula
  ON persona (cedula) WHERE cedula IS NOT NULL;
```
- [ ] **Step 2:** `npx prisma db push` (crea las tablas nuevas). Expected: `Your database is now in sync`.
- [ ] **Step 3:** Aplicar el SQL parcial: `psql "$DATABASE_URL" -f prisma/sql/2026-07-07_persona_cedula_unique.sql` (o vía cualquier cliente). Expected: `CREATE INDEX`.
- [ ] **Step 4:** Verificar: `psql "$DATABASE_URL" -c "\d persona"` muestra `uq_persona_cedula`.
- [ ] **Step 5:** Commit: `git add backend/prisma/sql && git commit -m "feat(schema): índice único parcial persona.cedula"`

---

## Phase 1 — Normalización de dirección (compartida, TDD)

### Task 1.1: Vectores de test compartidos

**Files:**
- Create: `backend/prisma/_fixtures/direccion_vectors.json`

**Interfaces:**
- Produces: array de casos `{in:{departamentoId,localidadId,calle,nro,apto}, out:"<clave>"}` que consumen TS y Python.

- [ ] **Step 1:** Crear el JSON con casos que cubren el algoritmo del spec §5.1:
```json
[
  {"in":{"departamentoId":"MO","localidadId":"MONTEVIDEO","calle":"Av. Italia","nro":"2020","apto":"301"}, "out":"MO|MONTEVIDEO|AV ITALIA 2020|301"},
  {"in":{"departamentoId":"MO","localidadId":"MONTEVIDEO","calle":"AVENIDA ITALIA","nro":"02020","apto":null}, "out":"MO|MONTEVIDEO|AV ITALIA 2020|"},
  {"in":{"departamentoId":"CA","localidadId":"LAS PIEDRAS","calle":"Gral. Artigas","nro":"145 bis","apto":"AP 2"}, "out":"CA|LAS PIEDRAS|GRAL ARTIGAS 145BIS|2"},
  {"in":{"departamentoId":"MO","localidadId":"MONTEVIDEO","calle":"Calle 3","nro":"10","apto":null}, "out":"MO|MONTEVIDEO|3 10|"},
  {"in":{"departamentoId":"MO","localidadId":"MONTEVIDEO","calle":null,"nro":"10","apto":null}, "out":""},
  {"in":{"departamentoId":"MO","localidadId":"MONTEVIDEO","calle":"Bvar. España","nro":"","apto":null}, "out":""}
]
```
- [ ] **Step 2:** Commit: `git add backend/prisma/_fixtures && git commit -m "test: vectores compartidos de normalización de dirección"`

### Task 1.2: `normalizeDireccion` en TS (TDD)

**Files:**
- Create: `backend/src/common/direccion/normalize-direccion.ts`
- Test: `backend/src/common/direccion/normalize-direccion.spec.ts`

**Interfaces:**
- Produces: `export function normalizeDireccion(f: {departamentoId?: string|number|null; localidadId?: string|number|null; calle?: string|null; nro?: string|null; apto?: string|null}): string` — devuelve `''` si falta calle o nro. `export const VIA_ABBR: Record<string,string>`.

- [ ] **Step 1: Test que falla** — cargar los vectores y assertar:
```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeDireccion } from './normalize-direccion';

const vectors = JSON.parse(readFileSync(join(__dirname, '../../../prisma/_fixtures/direccion_vectors.json'), 'utf8'));
describe('normalizeDireccion', () => {
  it.each(vectors)('normaliza %#', ({ in: input, out }) => {
    expect(normalizeDireccion(input)).toBe(out);
  });
});
```
- [ ] **Step 2:** Correr: `npm test -- normalize-direccion`. Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implementar** el algoritmo §5.1: NFD strip acentos, upper, quitar puntuación (`. , ° º #`) y colapsar espacios; canonizar vía con `VIA_ABBR` (`AVENIDA/AVDA/AV→AV`, `BULEVAR/BVAR/BR→BV`, `GENERAL/GRAL→GRAL`, `DOCTOR/DR→DR`, `CORONEL/CNEL→CNEL`, `INGENIERO/ING→ING`, `CAMINO/CNO→CNO`, `RUTA/RTA→RUTA`, `CALLE→''`); número: dígitos sin ceros a la izquierda + sufijo `BIS`/letra; apto: quitar `APTO|AP|APARTAMENTO|UNIDAD` y dejar id. Componer `DEP|LOC|VIA_CANON NRO|APTO`. Si no hay calle o nro → `''`.
- [ ] **Step 4:** Correr: `npm test -- normalize-direccion`. Expected: PASS (todos los vectores).
- [ ] **Step 5:** Commit: `git add backend/src/common/direccion && git commit -m "feat(direccion): normalizeDireccion + tests por vectores"`

### Task 1.3: `_normdir.py` mirror (misma salida)

**Files:**
- Create: `backend/prisma/_normdir.py`
- Test: `backend/prisma/_normdir_test.py`

**Interfaces:**
- Produces: `def normalize_direccion(departamentoId, localidadId, calle, nro, apto) -> str` con salida idéntica a la TS.

- [ ] **Step 1: Test que falla** — leer `_fixtures/direccion_vectors.json`, iterar y `assert normalize_direccion(**v['in']) == v['out']`.
- [ ] **Step 2:** Correr: `cd backend/prisma && python _normdir_test.py`. Expected: FAIL (import error).
- [ ] **Step 3:** Implementar el mismo algoritmo en Python (misma tabla `VIA_ABBR`).
- [ ] **Step 4:** Correr: `python _normdir_test.py`. Expected: `OK` (todos los vectores).
- [ ] **Step 5:** Commit: `git add backend/prisma/_normdir.py backend/prisma/_normdir_test.py && git commit -m "feat(etl): mirror Python de normalizeDireccion"`

---

## Phase 2 — Backfill de datos

### Task 2.1: `direccionTextoNorm` en todas las direcciones

**Files:**
- Create: `backend/prisma/etl_direccion_norm.py`

- [ ] **Step 1:** Script idempotente: lee `cliente_direccion` en chunks de 10k (id, departamentoId, localidadId, calle, nro, apto), calcula `normalize_direccion`, `UPDATE ... SET "direccionTextoNorm"=%s WHERE id=%s` con `execute_values`. Log de progreso cada 100k.
- [ ] **Step 2:** Correr: `python etl_direccion_norm.py`. Expected: `actualizadas: 1.130.155`.
- [ ] **Step 3:** Verificar: `psql -c "SELECT count(*) FROM cliente_direccion WHERE \"direccionTextoNorm\" <> ''"` > 0.
- [ ] **Step 4:** Commit: `git add backend/prisma/etl_direccion_norm.py && git commit -m "feat(etl): backfill direccionTextoNorm"`

### Task 2.2: Persona-de-uno (1:1 con cada registro)

**Files:**
- Create: `backend/prisma/etl_persona_de_uno.py`

**Interfaces:**
- Produces: una fila `persona` por cada `cliente_uni` con `personaId IS NULL`; setea `cliente_uni.personaId`, `persona.nombreOficial=nombre`, `telefonoPrincipalId`/`direccionPrincipalId` = el `principal` del registro (o el primero).

- [ ] **Step 1:** Script idempotente (solo procesa `personaId IS NULL`):
  - INSERT `persona (nombreOficial, cedula, rucPrincipal, estado)` desde cada `cliente_uni` (cédula/ruc si existen), devolviendo id; setear `cliente_uni.personaId`.
  - `UPDATE persona p SET "telefonoPrincipalId" = (SELECT id FROM cliente_telefono WHERE "clienteId"=cu.id ORDER BY principal DESC, id LIMIT 1), "direccionPrincipalId" = (SELECT id FROM cliente_direccion WHERE "clienteId"=cu.id ORDER BY principal DESC, id LIMIT 1) FROM cliente_uni cu WHERE cu."personaId"=p.id`.
  - Hacerlo por lotes (10k) en transacción.
- [ ] **Step 2:** Correr: `python etl_persona_de_uno.py`. Expected: `personas creadas: 1.130.155`.
- [ ] **Step 3:** Verificar 1:1: `psql -c "SELECT count(*) FROM cliente_uni WHERE \"personaId\" IS NULL"` = 0.
- [ ] **Step 4:** Re-correr para idempotencia: Expected `personas creadas: 0`.
- [ ] **Step 5:** Commit: `git add backend/prisma/etl_persona_de_uno.py && git commit -m "feat(etl): persona-de-uno backfill 1:1"`

---

## Phase 3 — Motor de sugerencias (Python → match_sugerencia)

### Task 3.1: Sugerencias de DUPLICADO

**Files:**
- Create: `backend/prisma/etl_sugerencias.py`

**Interfaces:**
- Produces: filas `match_sugerencia` con `tipo='DUPLICADO'`, `registroA`/`registroB` (pares de `cliente_uni.id`), `senal ∈ {CEDULA,RUC,TEL+NOMBRE}`, `confianza`, `estado='PENDIENTE'`. Idempotente: no re-inserta un par ya presente (ordenar `registroA<registroB`).

- [ ] **Step 1:** Adaptar la lógica de `dedup_clientes.py` (reusar `norm` + rapidfuzz), pero **emitiendo pares** a `match_sugerencia` en vez de marcar `dedupGrupo`:
  - CÉDULA: `cliente_uni` con misma `cedula` no nula → pares, `confianza=0.99`.
  - RUC: misma `ruc` válida (no `''`/`'0'`) → pares, `confianza=0.9`.
  - TEL+NOMBRE: teléfono activo compartido + `token_sort_ratio>=85` → pares, `confianza = ratio/100`.
  - Antes de insertar cada par, `WHERE NOT EXISTS (... registroA=LEAST, registroB=GREATEST ...)`.
- [ ] **Step 2:** Correr: `python etl_sugerencias.py --tipo duplicado`. Expected: imprime conteos por señal.
- [ ] **Step 3:** Verificar: `psql -c "SELECT senal,count(*) FROM match_sugerencia WHERE tipo='DUPLICADO' GROUP BY senal"`.
- [ ] **Step 4:** Idempotencia: re-correr → `insertados: 0`.
- [ ] **Step 5:** Commit: `git add backend/prisma/etl_sugerencias.py && git commit -m "feat(etl): sugerencias DUPLICADO → match_sugerencia"`

### Task 3.2: Sugerencias de HOGAR

**Files:**
- Modify: `backend/prisma/etl_sugerencias.py`

**Interfaces:**
- Produces: filas `tipo='HOGAR'`, `personaA`/`personaB` (personas distintas), `senal ∈ {MISMA_DIRECCION, MISMA_DIRECCION_APTO_DISTINTO, PROXIMIDAD_GEO}`, idempotente por par de personas.

- [ ] **Step 1:** Agregar rama `--tipo hogar`:
  - Agrupar `cliente_direccion` por `direccionTextoNorm` (no vacío) con ≥2 personas distintas (join `cliente_uni.personaId`) → pares de personas, `senal='MISMA_DIRECCION'`, `confianza=0.9`.
  - Proximidad geo: para direcciones con lat/lng, pares dentro de `HOGAR_PROXIMIDAD_METROS` (env, default 25) vía fórmula haversine en SQL, distinta persona → `senal='PROXIMIDAD_GEO'`, `confianza=0.7`. (Si comparten edificio pero difiere apto en la clave textual → `MISMA_DIRECCION_APTO_DISTINTO`, `confianza=0.6`.)
  - Idempotente por `(personaA<personaB, tipo)`.
- [ ] **Step 2:** Correr: `python etl_sugerencias.py --tipo hogar`. Expected: conteos por señal.
- [ ] **Step 3:** Verificar counts en `match_sugerencia WHERE tipo='HOGAR'`.
- [ ] **Step 4:** Commit: `git commit -am "feat(etl): sugerencias HOGAR por dirección/proximidad"`

---

## Phase 4 — Backend: Personas + Workbench + Hogar

### Task 4.1: PersonasService — vista 360 y helpers

**Files:**
- Create: `backend/src/personas/personas.service.ts`, `personas.module.ts`
- Test: `backend/src/personas/personas.service.spec.ts`

**Interfaces:**
- Produces:
  - `find360(personaId: number): Promise<Persona360>` donde `Persona360 = { persona, registros, telefonos, direcciones, hogares }` — agrega tel/dir de TODOS los registros de la persona.
  - `unify(registroIds: number[], operador: string): Promise<{personaId:number}>` — elige persona destino (la del primer registro), repunta los demás `cliente_uni.personaId`, y borra las personas que quedaron sin registros. Reversible: registra en `match_sugerencia`/log (ver 4.2). Transaccional.
  - `setCanonical(personaId, dto: {nombreOficial?, cedula?, telefonoPrincipalId?, direccionPrincipalId?}): Promise<Persona>`.

- [ ] **Step 1: Test que falla** (usar `PrismaService` mock o DB de test): `unify([A,B])` deja ambos registros con el mismo `personaId` y elimina la persona huérfana; `find360` agrega tel de ambos registros. (Mock de prisma con jest.)
- [ ] **Step 2:** `npm test -- personas.service`. Expected: FAIL.
- [ ] **Step 3:** Implementar el service con `PrismaService` (transacciones `$transaction`). `find360` hace `persona.findUnique` con `include: registros → {telefonos, direcciones}` + `miembroDe → hogar`.
- [ ] **Step 4:** `npm test -- personas.service`. Expected: PASS.
- [ ] **Step 5:** Commit: `git add backend/src/personas && git commit -m "feat(personas): find360 + unify + setCanonical"`

### Task 4.2: WorkbenchService — resolver sugerencias (con undo)

**Files:**
- Create: `backend/src/workbench/workbench.service.ts`, `workbench.module.ts`
- Test: `backend/src/workbench/workbench.service.spec.ts`

**Interfaces:**
- Consumes: `PersonasService.unify`, `HogarService.crearConMiembros` (Task 4.4).
- Produces:
  - `listar(q:{tipo?, estado?, minConfianza?, page, pageSize}): Promise<Paginated<MatchSugerencia>>` (orden confianza desc).
  - `aceptar(id:number, operador:string): Promise<void>` — si `DUPLICADO` → `unify([registroA,registroB])`; si `HOGAR` → `hogar.crearConMiembros([personaA,personaB])`. Marca `estado='ACEPTADO'`, `resueltoAt`, `operador`.
  - `rechazar(id, operador): Promise<void>` — `estado='RECHAZADO'`.
  - `deshacer(id): Promise<void>` — revierte: para HOGAR quita los miembros creados; para DUPLICADO **no** se re-parte automáticamente (documentar: split manual vía `PersonasService.split` — Task 4.3). Vuelve la sugerencia a `PENDIENTE`.

- [ ] **Step 1: Test que falla:** `aceptar(dupId)` llama `unify` y marca ACEPTADO; `aceptar(hogarId)` crea hogar con 2 miembros.
- [ ] **Step 2:** `npm test -- workbench.service`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test -- workbench.service`. Expected: PASS.
- [ ] **Step 5:** Commit: `git add backend/src/workbench && git commit -m "feat(workbench): aceptar/rechazar/listar sugerencias"`

### Task 4.3: PersonasService.split (deshacer unificación)

**Files:**
- Modify: `backend/src/personas/personas.service.ts`
- Test: `backend/src/personas/personas.service.spec.ts`

**Interfaces:**
- Produces: `split(registroIds:number[]): Promise<{nuevas:number[]}>` — a cada registro le crea de nuevo su persona-de-uno (revierte una unificación). El crudo intacto lo hace siempre posible.

- [ ] **Step 1: Test que falla:** tras `unify([A,B])`, `split([B])` deja B con persona propia nueva.
- [ ] **Step 2:** `npm test -- personas.service`. Expected: FAIL en el nuevo test.
- [ ] **Step 3:** Implementar `split`.
- [ ] **Step 4:** `npm test -- personas.service`. Expected: PASS.
- [ ] **Step 5:** Commit: `git commit -am "feat(personas): split para revertir unificación"`

### Task 4.4: HogarService

**Files:**
- Create: `backend/src/personas/hogar.service.ts` (mismo módulo personas)
- Test: `backend/src/personas/hogar.service.spec.ts`

**Interfaces:**
- Produces:
  - `crearConMiembros(personaIds:number[], etiqueta?:string): Promise<Hogar>` — crea `hogar` (ancla dirección/geo de la principal de la 1ª persona) + `hogar_miembro` por cada persona (idempotente por `[hogarId,personaId]`). Si ya existe un hogar con esa `direccionTextoNorm`, agrega miembros a ese.
  - `agregarMiembro(hogarId, personaId, rol?)`, `quitarMiembro(hogarId, personaId)`.
- [ ] **Step 1: Test que falla:** `crearConMiembros([P1,P2])` crea 1 hogar con 2 miembros; re-llamar no duplica miembros.
- [ ] **Step 2:** `npm test -- hogar.service`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test -- hogar.service`. Expected: PASS.
- [ ] **Step 5:** Commit: `git add backend/src/personas/hogar* && git commit -m "feat(hogar): crear/gestionar miembros"`

### Task 4.5: Controllers Personas + Workbench

**Files:**
- Create: `backend/src/personas/personas.controller.ts`, `backend/src/workbench/workbench.controller.ts` + DTOs
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces (rutas bajo `api/`, `@UseGuards(AuthGuard)`):
  - `GET personas/:id` → `find360`
  - `PATCH personas/:id/canonical` → `setCanonical`
  - `POST personas/unify` `{registroIds:number[]}` → `unify`
  - `POST personas/split` `{registroIds:number[]}` → `split`
  - `GET workbench/sugerencias` (query) → `listar`
  - `POST workbench/sugerencias/:id/aceptar` / `/rechazar` / `/deshacer`

- [ ] **Step 1:** Escribir controllers + DTOs (`class-validator`), tomando `operador` de `req.user?.username`. Registrar `PersonasModule` y `WorkbenchModule` en `app.module.ts`.
- [ ] **Step 2:** Build: `npm run build`. Expected: sin errores TS.
- [ ] **Step 3:** Smoke test (opcional local): `GET /api/workbench/sugerencias?tipo=DUPLICADO` responde 200 con array.
- [ ] **Step 4:** Commit: `git add backend/src && git commit -m "feat(api): endpoints personas + workbench"`

---

## Phase 5 — Backend: Cobertura + Identificación redactada (privacidad)

### Task 5.1: CoberturaService.upsertInteraccion

**Files:**
- Create: `backend/src/cobertura/cobertura.service.ts`, `cobertura.module.ts`
- Test: `backend/src/cobertura/cobertura.service.spec.ts`

**Interfaces:**
- Produces: `upsertInteraccion(p:{personaId:number; puestoId:number; empresaFleteraId:number; tipo:'LLAMADA_DIRECTA'|'ENTREGA_MOVIL'; fecha:Date}): Promise<Cobertura>` — upsert por `[personaId,empresaFleteraId]`: si existe, `ultFecha=max`, `cantPedidos+1`, `tipoInteraccion` actualizado; si no, crea con `primeraFecha=fecha`. `tieneAfiliacion(personaId, empresaFleteraId): Promise<boolean>`.

- [ ] **Step 1: Test que falla:** primer `upsert` crea con `cantPedidos=1`; segundo con fecha mayor sube `ultFecha` y `cantPedidos=2`.
- [ ] **Step 2:** `npm test -- cobertura.service`. Expected: FAIL.
- [ ] **Step 3:** Implementar con `prisma.cobertura.upsert` (unique `[personaId,empresaFleteraId]`).
- [ ] **Step 4:** `npm test -- cobertura.service`. Expected: PASS.
- [ ] **Step 5:** Commit: `git add backend/src/cobertura && git commit -m "feat(cobertura): upsertInteraccion + tieneAfiliacion"`

### Task 5.2: Redacción por rol (función pura, TDD)

**Files:**
- Create: `backend/src/identificacion/redaccion.ts`
- Test: `backend/src/identificacion/redaccion.spec.ts`

**Interfaces:**
- Produces:
```ts
export type Rol = 'CALL_CENTER' | 'DISTRIBUIDOR';
export interface FichaCompleta { persona: {...}; telefonos: Tel[]; direcciones: Dir[]; hogares: any[]; observaciones?: string; cedula?: string; }
export interface FichaRedactada { nombre: string; estado?: string; cedula?: string; telefono?: Tel; direccion?: Dir; scope: 'MINIMA'|'AFILIADA'|'COMPLETA'; }
export function redactar(f: FichaCompleta, rol: Rol, afiliado: boolean): FichaRedactada;
```
Reglas (spec §6): `CALL_CENTER`→`COMPLETA` (todo). `DISTRIBUIDOR` + `!afiliado`→`MINIMA` (solo `nombre`). `DISTRIBUIDOR` + `afiliado`→`AFILIADA` (`nombre`,`estado`,`cedula`, **último** teléfono por `ultFecha` desc, **última** dirección por `ultFecha` desc; SIN observaciones, SIN hogar, SIN otras zonas).

- [ ] **Step 1: Test que falla:** 3 casos (call_center ve todo; distribuidor no afiliado ve solo nombre; distribuidor afiliado ve cédula + 1 tel el más reciente + 1 dir + sin obs).
- [ ] **Step 2:** `npm test -- redaccion`. Expected: FAIL.
- [ ] **Step 3:** Implementar `redactar` (pura, ordena por `ultFecha` desc y toma el primero).
- [ ] **Step 4:** `npm test -- redaccion`. Expected: PASS.
- [ ] **Step 5:** Commit: `git add backend/src/identificacion/redaccion* && git commit -m "feat(identificacion): redacción por rol/afiliación"`

### Task 5.3: IdentificacionService — lookup exacto + 3 desenlaces

**Files:**
- Create: `backend/src/identificacion/identificacion.service.ts`, `identificacion.module.ts`
- Test: `backend/src/identificacion/identificacion.service.spec.ts`

**Interfaces:**
- Consumes: `PersonasService.find360`, `CoberturaService.tieneAfiliacion`, `redactar`.
- Produces: `identificar(p:{identificador:string; tipo:'CEDULA'|'TELEFONO'; rol:Rol; empresaFleteraId?:number}): Promise<{ resultado:'MATCH'|'SIN_MATCH'; ficha?:FichaRedactada; requiereAltaDireccion?:boolean }>`.
  - Busca persona por identificador **exacto** (cédula en `persona.cedula`; teléfono en `cliente_telefono.numero` → registro → persona).
  - Si no hay → `SIN_MATCH` (desenlace 3, el front hará alta).
  - Si hay → `afiliado = tieneAfiliacion(persona, empresaFleteraId)` (call center = siempre "afiliado"/completa). `ficha = redactar(find360, rol, afiliado)`. Si distribuidor afiliado **sin** dirección en su relación → `requiereAltaDireccion=true` (desenlace 2).

- [ ] **Step 1: Test que falla:** teléfono exacto matchea persona; distribuidor no afiliado → ficha MINIMA; distribuidor afiliado sin dir → `requiereAltaDireccion=true`; sin match → `SIN_MATCH`.
- [ ] **Step 2:** `npm test -- identificacion.service`. Expected: FAIL.
- [ ] **Step 3:** Implementar (búsqueda exacta, sin `contains`).
- [ ] **Step 4:** `npm test -- identificacion.service`. Expected: PASS.
- [ ] **Step 5:** Commit: `git add backend/src/identificacion && git commit -m "feat(identificacion): lookup exacto + 3 desenlaces"`

### Task 5.4: IdentificacionController + scoping por rol

**Files:**
- Create: `backend/src/identificacion/identificacion.controller.ts` + DTO
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `POST api/identificacion` `{identificador, tipo}` → toma `rol` y `empresaFleteraId` de `req.user` (secapi), llama `identificar`, devuelve `FichaRedactada`. **Nunca** acepta `rol` desde el body.

- [ ] **Step 1:** Escribir controller (AuthGuard) + DTO; leer `req.user.rol` / `req.user.empresaFleteraId`. Registrar módulos en `app.module.ts`.
- [ ] **Step 2:** Build: `npm run build`. Expected: sin errores.
- [ ] **Step 3:** Test e2e mínimo o smoke: un `req.user` distribuidor no ve más que la ficha redactada.
- [ ] **Step 4:** Commit: `git add backend/src && git commit -m "feat(api): identificacion con scoping por rol desde secapi"`

---

## Phase 6 — (Plan aparte) Frontend

Workbench UI (cola de sugerencias + unificar/hogar/undo), vista 360 del call center, y flujo de identificación del distribuidor. Se especifica en un plan separado `2026-07-07-clientes-identidad-frontend.md` tras validar el backend.

---

## Self-Review

- **Cobertura del spec:** §4 modelos → Phase 0; §5 normalización/dedup/hogar → Phases 1-3; §5.1 normalización → Task 1.2/1.3; §6 privacidad → Phase 5; §7 3 desenlaces → Task 5.3; §8 migración → Phases 0/2/3; hooks a pedidos (`cobertura`, `ultFecha`) → Task 5.1 (columnas ya en 0.1). Frontend §UI → Phase 6 (plan aparte). ✔
- **Placeholders:** los pasos DB/ETL referencian conteos reales; los tests puros llevan código. Sin TODO/TBD.
- **Consistencia de tipos:** `unify(registroIds)`, `find360`, `redactar(f,rol,afiliado)`, `tieneAfiliacion`, `upsertInteraccion` usados igual en 4.x/5.x. ✔
