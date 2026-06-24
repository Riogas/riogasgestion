# Modelo unificado de Clientes — Migración de datos (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development o superpowers:executing-plans para ejecutar tarea por tarea. Pasos en checkbox (`- [ ]`).

**Goal:** Construir en Postgres (goya) el modelo unificado de clientes (interior + capital) y migrar los datos de ambos orígenes a las nuevas tablas, siguiendo `docs/superpowers/specs/2026-06-24-modelo-unificado-clientes-design.md`.

**Architecture:** Tablas nuevas Prisma (cliente slim + cliente_telefono + cliente_direccion + catálogos) creadas **alongside** la `cliente` plana actual (que se conserva hasta la fase de adaptación del front, plan aparte). ETLs Python (patrón de `backend/prisma/etl_*.py` + `_creds.py`) leen del AS400 (jt400) y del propio Postgres, transforman y cargan. Idempotentes por `(origen, id_original)`.

**Tech Stack:** Prisma 6 + PostgreSQL (goya @192.168.2.117), Python (jaydebeapi+jt400, psycopg2, pyproj, rapidfuzz), AS400/DB2 (jt400, esquemas `PUESTOS` y `GXCALDTA`).

## Global Constraints

- **NO hardcodear secretos** en scripts: creds desde `backend/.env` vía `backend/prisma/_creds.py`.
- Tablas/columnas en `snake_case`/`@@map` como en la spec. `id` surrogate `autoincrement`; índice único `(origen, id_original)`.
- **No tocar la `cliente` plana actual** (la usa el panel) hasta el plan de adaptación de front; las tablas nuevas son aditivas. Para evitar choque de nombre, el modelo slim nuevo se crea como **`cliente_uni`** y al final (plan de front) se renombra a `cliente`.
- ETLs **idempotentes y re-ejecutables** (`--limit`, batcheado, commit por lote).
- Calles: **sin catálogo** — dirección como texto. La tabla `calle` actual se dropea recién en el plan de cleanup.
- Cédula: columna nueva nullable, queda NULL en la migración (se llena a futuro).
- Cada ETL termina con un **chequeo de validación** (conteos/sample) como "test".

---

### Task 1: Schema nuevo (Prisma) alongside

**Files:**
- Modify: `backend/prisma/schema.prisma` (agregar modelos; NO tocar `Cliente`/`Calle` existentes)

**Interfaces:**
- Produces: tablas `cliente_uni`, `cliente_telefono`, `cliente_direccion`, `puesto`, `departamento`, `localidad`, `tipo_cliente`, `categoria_precio`, `zona` en goya.

- [ ] **Step 1: Agregar los modelos al schema** (copiar de la spec §4, con el modelo slim mapeado a `@@map("cliente_uni")` y relaciones apuntando a `ClienteUni`). Incluir todos los índices (`@@unique([origen, idOriginal])`, índices de nombre/ruc/cedula/estado; FKs de telefono/direccion a `ClienteUni`).

- [ ] **Step 2: Push a goya**

Run: `cd backend && npx prisma db push --skip-generate`
Expected: "Your database is now in sync" — crea las 9 tablas nuevas sin tocar `cliente`/`calle`.

- [ ] **Step 3: Validación**

Run (psycopg2): `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('cliente_uni','cliente_telefono','cliente_direccion','puesto','departamento','localidad','tipo_cliente','categoria_precio','zona')`
Expected: 9 filas.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(db): schema unificado de clientes (tablas nuevas alongside)"
```

---

### Task 2: ETL catálogos (puesto, departamento, localidad, tipo_cliente, categoria_precio, zona) + puesto Montevideo

**Files:**
- Create: `backend/prisma/etl_catalogos.py`

**Interfaces:**
- Consumes: `_creds.as400()`, `_creds.pg_conn_args()`.
- Produces: catálogos poblados; puesto id **100 = "Montevideo"** creado.

- [ ] **Step 1: Escribir el ETL** — leer de `PUESTOS.{PUESTOS, DEPARTAMENTO, LOCALIDAD, TIPOCLIENTE, CATEGORIA, ZONA}`, limpiar (trim, `LOCALIDADLATITUD/LONGITUD`→decimal), `TRUNCATE`+insert por tabla, y un `INSERT` extra del puesto `id=100, nombre='Montevideo', departamentoId=<Montevideo>`. Mapeo de columnas según spec §4.4.

- [ ] **Step 2: Correr**

Run: `python backend/prisma/etl_catalogos.py`
Expected: puesto≈19 (18+Montevideo), departamento=19, localidad=1406, tipo_cliente=29, categoria_precio=6, zona=280.

- [ ] **Step 3: Validación** — conteos coinciden + `SELECT * FROM puesto WHERE id=100` devuelve Montevideo.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/etl_catalogos.py
git commit -m "feat(etl): catalogos (puesto/depto/localidad/tipo/categoria/zona) + puesto Montevideo"
```

---

### Task 3: ETL re-dimensionar CAPITAL (cliente plano goya → cliente_uni + cliente_direccion)

**Files:**
- Create: `backend/prisma/etl_capital_split.py`

**Interfaces:**
- Consumes: tabla `cliente` plana actual (goya), `_creds.pg_conn_args()`.
- Produces: filas en `cliente_uni` (origen='capital') y `cliente_direccion` (puesto 100) con la geo ya calculada.

- [ ] **Step 1: Escribir el ETL** — leer `cliente` plano por lotes; por cada fila insertar:
  - `cliente_uni`: origen='capital', id_original=id, nombre/ruc/email/estado/tipoServicioId/vip/observaciones/gciNro/fechaAlta/ultimaLlamada/operadores. cedula NULL. Guardar el `id` nuevo (RETURNING) mapeado a id_original.
  - `cliente_direccion`: clienteId=nuevo id, puestoId=100, departamentoId=Montevideo, **direccion/lat/lng/geoFuente/calleMatch/geoVerificadoAt** (de la geo ya hecha), + calle/nro/esquinas/bis/apto/solar/etc. de los campos embebidos, `principal=true`.

- [ ] **Step 2: Correr con muestra** `--limit 500`, validar mapeo (sample), luego completo.

- [ ] **Step 3: Validación** — `count(cliente_uni WHERE origen='capital')` ≈ 933.959; cada uno con ≥1 `cliente_direccion`; geo preservada (spot-check 5 ids).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/etl_capital_split.py
git commit -m "feat(etl): re-dimensionar capital (cliente plano -> cliente_uni + direccion)"
```

---

### Task 4: ETL teléfonos CAPITAL (GXCALDTA.TELCLI → cliente_telefono)

**Files:**
- Create: `backend/prisma/etl_capital_tel.py`

**Interfaces:**
- Consumes: `GXCALDTA.TELCLI` (AS400), mapa id_original→cliente_uni.id (origen='capital').
- Produces: `cliente_telefono`.

- [ ] **Step 1: Escribir el ETL** — leer `GXCALDTA.TELCLI` por lotes (TELFNRO, CLIID, CLITELESTA, CLITELOBS); resolver cliente_uni.id por (origen='capital', id_original=CLIID); insertar `cliente_telefono` (numero, estado normalizado A/otros, obs). Saltar los CLIID sin cliente.

- [ ] **Step 2: Correr** (2.1M filas, batcheado).

- [ ] **Step 3: Validación** — `count(cliente_telefono)` razonable vs 2.135.139 menos huérfanos; sample 5.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/etl_capital_tel.py
git commit -m "feat(etl): telefonos capital (TELCLI -> cliente_telefono)"
```

---

### Task 5: ETL INTERIOR clientes + direcciones (PUESTOS.CLIENTE + CLIENTEDIRECCION)

**Files:**
- Create: `backend/prisma/etl_interior.py`

**Interfaces:**
- Consumes: `PUESTOS.CLIENTE`, `PUESTOS.CLIENTEDIRECCION` (AS400).
- Produces: `cliente_uni` (origen='interior') + `cliente_direccion` (puestoId=CLIPUESTOID).

- [ ] **Step 1: Escribir el ETL** — por cada `PUESTOS.CLIENTE`:
  - `cliente_uni`: origen='interior', id_original=CLIID, + nombre/ruc/email/estado/tipoClienteId(CLITPOCLIID)/vip/puntosSaldo/fleteCobra/fleteCantidad/categoriaPrecioId(CLICATPRECIOID)/gci/fechas/operadores. cedula NULL.
  - `cliente_direccion` (embebida): puestoId=CLIPUESTOID, departamentoId(DEPARTAMENTOID), localidadId(CIUDADID→localidad si mapea, else null), calle=CALPRINNOM, nro=CLINROPUERTA, esquina1=CALESQ1NOM, esquina2=CALESQ2NOM, bis/apto/solar/nivel/local/manzana/km, lat/lng de CLICOORDX/Y (normalizar), `direccion` armada, principal=true.
  - Por cada `PUESTOS.CLIENTEDIRECCION` del cliente (1:N): una `cliente_direccion` extra (DIRECCIONCALLE/NRO/ESQ…, lat/lng de DIRECCIONLATITUD/LONGITUD, cantGarrafas/usoGarrafa/tipoProducto), principal=false.

- [ ] **Step 2: Correr con muestra** `--limit 500`, validar, luego completo (~196k).

- [ ] **Step 3: Validación** — `count(cliente_uni WHERE origen='interior')`≈196.191; direcciones ≥ clientes; sample con esquinas/garrafas.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/etl_interior.py
git commit -m "feat(etl): interior clientes + direcciones (PUESTOS)"
```

---

### Task 6: ETL teléfonos INTERIOR (PUESTOS.CLITEL → cliente_telefono)

**Files:**
- Create: `backend/prisma/etl_interior_tel.py`

- [ ] **Step 1: Escribir el ETL** — leer `PUESTOS.CLITEL` (TELFNRO, CLIPUESTOID, CLIID, CLITELESTADO, TELTIPO); resolver cliente_uni.id por (origen='interior', id_original=CLIID); insertar `cliente_telefono` (numero, tipo=TELTIPO, estado=CLITELESTADO).

- [ ] **Step 2: Correr** (197k).

- [ ] **Step 3: Validación** — conteos + sample.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/etl_interior_tel.py
git commit -m "feat(etl): telefonos interior (CLITEL -> cliente_telefono)"
```

---

### Task 7: Re-correr geoinversa sobre cliente_direccion (ambos orígenes)

**Files:**
- Modify: `backend/prisma/backfill_geo.py` (apuntar a `cliente_direccion` en vez de `cliente`)

- [ ] **Step 1: Adaptar el backfill** — leer de `cliente_direccion` (lat/lng ya cargadas o coords crudas), geoinversa Nominatim, escribir `direccion`/`calleGeo`(→ no, ahora `calle`)/`calleMatch`/`geoVerificadoAt`. Para interior usar lat/lng ya presentes; para capital ya vienen de la migración (no re-geoinversar si ya está verificado, `--solo-pendientes`).

- [ ] **Step 2: Correr** sobre las direcciones sin verificar.

- [ ] **Step 3: Validación** — `count(cliente_direccion WHERE calle_match IS NOT NULL)` crece; sample.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/backfill_geo.py
git commit -m "feat(etl): geoinversa sobre cliente_direccion (interior+capital)"
```

---

### Task 8: Dedup — detección (RUC / teléfono activo + nombre similar)

**Files:**
- Create: `backend/prisma/dedup_clientes.py`
- Modify: `backend/prisma/schema.prisma` (agregar `dedupGrupo Int?`, `dedupRevisar Boolean?` a `ClienteUni`; push)

- [ ] **Step 1: Agregar columnas dedup** al modelo y `prisma db push`.

- [ ] **Step 2: Escribir el detector** —
  (a) agrupar por `ruc` válido (no nulo/0);
  (b) agrupar por teléfono `estado='A'` compartido entre 2+ clientes **con nombre similar** (rapidfuzz `token_sort_ratio` ≥ 0.85 sobre nombre normalizado).
  Asignar `dedup_grupo` (id del grupo) y `dedup_revisar=true` a los candidatos. **No fusionar** (solo marcar).

- [ ] **Step 3: Correr** + reporte: cuántos grupos, cuántos clientes marcados.

- [ ] **Step 4: Validación** — sample de 10 grupos para verificar que son candidatos plausibles.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/dedup_clientes.py
git commit -m "feat(etl): deteccion de clientes duplicados (ruc/telefono+nombre)"
```

---

## Fuera de alcance (planes aparte)
- **Fase 8 spec — adaptar backend NestJS + frontend** (módulo clientes con tabs direcciones/teléfonos; renombrar `cliente_uni`→`cliente`, dropear `cliente` plano y `calle`). Plan propio.
- **Fase 9 spec — sync bidireccional transitorio** AS400 ↔ goya. Plan propio.

## Self-Review
- **Cobertura spec §4/§5:** schema (T1), catálogos+Montevideo (T2), capital split+geo (T3), tel capital (T4), interior cli+dir (T5), tel interior (T6), geo (T7), dedup (T8). ✓
- **Pendientes spec §9 cubiertos:** estados de teléfono normalizados (T4/T6), localidad opcional (T5), puesto en dirección (T3/T5). Mapeo tipo/categoría = se traslada tal cual (IDs por origen; unificación fina queda para config). ✓
- **Naming:** `cliente_uni` consistente en T1/T3/T4/T5/T6/T8 (se renombra a `cliente` en el plan de front).
