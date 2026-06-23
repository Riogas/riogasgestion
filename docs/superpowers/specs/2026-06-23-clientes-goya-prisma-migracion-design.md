# Migración de Clientes a base `goya` (Prisma + ETL desde AS400)

**Fecha:** 2026-06-23
**Estado:** Implementado (panel/lista + backend + ETL). Ficha de detalle = follow-up.

## Contexto

El panel de admin de clientes (`/dashboard/clientes`) consumía el backend **legacy GeneXus**
(`sgm.glp.riogas.com.uy`) vía el proxy `/api`. Se decidió migrar a una **nueva estructura
canónica**: base PostgreSQL `goya` en `192.168.2.117`, alimentada de a poco desde el AS400.

## Decisiones tomadas

- **DB destino:** `goya` @ `192.168.2.117:5432` (user `postgres`). Estaba vacía.
- **ORM:** migrar **todo el backend NestJS de TypeORM → Prisma** (el backend solo tenía el
  módulo `clientes` + `health`, así que el alcance fue acotado).
- **Fuente de datos:** `GXCALDTA.CLIENTE` en el AS400/DB2 (`192.168.1.8`, jt400), 57 columnas,
  ~933.958 filas.
- **Forma de tabla:** una sola tabla **plana** `cliente` que espeja GeneXus, con **nombres
  limpios** y **sin los 13 campos AUX**. Normalización (teléfonos/direcciones) = a futuro.
- **Tipos:** fieles al origen pero "lindos":
  - Fechas `CHAR(8)` `YYYYMMDD` (CLIFCHALTA/CLIFCH/DIRFCHGEO) → `DateTime @db.Date` (parseadas
    en el ETL; `00000000`/blancos → NULL).
  - `CLIULTLLAM` (TIMESTMP real) → `DateTime`.
  - `CLIRUC` `DEC(12)` → `String` (`0` → NULL).
  - `CLIESTADO` `CHAR(1)` → `String` (código A/I/P/…).
  - `CLIVIP` `DEC(1)` → `Boolean`.
  - `CLIID` `DEC(9)` → `Int @id` (no autogenerado: se importa con el id original).

## Arquitectura

```
Frontend (/dashboard/clientes)
  → axios /api/clientes  (NEXT_PUBLIC_API_BACKEND=nestjs)
  → proxy Next /api/[...path]  → http://localhost:3001/api/clientes
  → NestJS ClientesController (AuthGuard) → ClientesService (PrismaService)
  → Postgres goya.public.cliente
```

ETL (one-shot / re-ejecutable):
```
AS400 GXCALDTA.CLIENTE  --(jt400 / jaydebeapi, batches 5000)-->  transform  -->  goya.cliente (psycopg2)
```

## Componentes

### Backend (`backend/`)
- `prisma/schema.prisma` — datasource postgres (`DATABASE_URL`), modelo `Cliente` (44 campos
  limpios + `createdAt`/`updatedAt`), `@@map("cliente")`, índices en nombre/estado/zona.
- `src/prisma/prisma.service.ts` + `prisma.module.ts` (global).
- `src/app.module.ts` — se removió `TypeOrmModule`, se agregó `PrismaModule`.
- `src/clientes/` — `clientes.service.ts` reescrito con Prisma (findAll con paginación +
  búsqueda nombre/email/ruc + filtros estado/zona/tipoId; findOne/create/update/remove).
  Controller con `ParseIntPipe` (id Int). Se eliminaron endpoints/DTOs de teléfonos y
  direcciones, entities, `data-source.ts`, `migrations/` e `import-padron`.
- `src/health/health.controller.ts` — health check de DB vía Prisma `$queryRaw`.
- `.env` — `DATABASE_URL` (password URL-encoded).
- ORM: se quitaron `@nestjs/typeorm` y `typeorm`; se fijó **Prisma 6** (la 7 cambia el modelo
  de conexión y requiere `prisma.config.ts` + driver adapter).

### ETL (`backend/prisma/etl_clientes.py`)
- Lee 44 columnas no-AUX de `GXCALDTA.CLIENTE`, transforma (helpers `s/i/num/ymd/ts`),
  `TRUNCATE` + insert batcheado (`execute_values`) en `goya.cliente`. Re-ejecutable.

### Frontend (`src/`)
- `lib/types/cliente.ts` — `Cliente` redefinido a la forma plana; `QueryClientesParams`
  (estado/zona/tipoId). Tipos legacy (telefono/direccion/zod/forms) se conservan para que el
  resto del módulo compile.
- `components/dashboard/clientes/ClientesList.tsx` — columnas nuevas (Nro, Nombre, Estado
  por código, RUC, Email, Zona, Alta, Últ. llamada) y stats (total, activos, pendientes, VIP,
  con email).
- `.env.local` — `NEXT_PUBLIC_API_BACKEND=nestjs`.

## Verificación

- `prisma db push` creó la tabla `cliente` en goya (44 cols + índices). ✓
- Backend levanta y conecta a goya; `GET /api/health/db` → `connected` (PostgreSQL 15.18). ✓
- `GET /api/clientes` devuelve datos reales en la forma nueva. ✓
- ETL migró ~933.958 filas (conteo final verificado). ✓

## Follow-ups (fuera de alcance de esta entrega)

1. **Ficha de detalle del cliente** (`/dashboard/clientes/[id]`, header/resumen/tabs,
   `nuevo`, `AltaSlideOver`, mutation hooks): siguen modelados sobre la forma normalizada
   (tabs de teléfonos/direcciones). No compilan contra la tabla plana → **romperían
   `next build`**. Requieren rediseño (qué mostrar/editar de un registro plano). ~65 errores TS.
2. Catálogos referenciados por id (calles, zonas, tipos, servicios) no migrados.
3. Auth real del backend (AuthGuard hoy no verifica firma sin `JWT_SECRET`).
4. Deploy: el backend NestJS debe correr en el server (`:3001`) para que el panel productivo
   apunte a goya; hoy `.env.production` sigue en `legacy`.
