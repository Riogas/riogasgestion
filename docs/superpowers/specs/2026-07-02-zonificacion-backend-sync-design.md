# Zonificación: backend real + espejo TrackMovil

Fecha: 2026-07-02 · Estado: aprobado por Juan

## Objetivo

Persistir las zonas operativas de la pantalla `/dashboard/zonificacion` en el
Postgres de goya y mantenerlas **espejadas** con la tabla `zonas` del Supabase
de TrackMovil (`https://supabase.glp.riogas.com.uy`). Por ahora solo goya crea
y modifica zonas; queda una API de sincro para que track empuje cambios a
futuro.

## Decisiones (con Juan, 2026-07-02)

1. **Tabla nueva `zona_operativa`** en goya (no se extiende la `zona` legacy
   del AS400, que es del ETL y la usan fleteras/catálogos).
2. **Puestos reales** de la tabla `puesto` (16 activos), muere el mock.
3. **Mapeo formal `puesto_escenario`** (puestoId → escenarioId de track).
   Seed inicial: Montevideo `100 → 1000`. Puesto sin mapeo = zona solo-goya.
4. **Vía de sync saliente:** la API de import de track
   (`/api/import/zonas`, header `x-api-key`, upsert por `zona_id`).
5. **Carga inicial:** pull desde track (las zonas existentes entran a goya).
6. **Bajas:** archivar → `activa:false` en track; eliminar → DELETE en ambos.

## Shape del espejo (tabla `zonas` en Supabase track)

`zona_id` (PK), `escenario_id`, `nombre`, `descripcion`, `color`,
`activa` (bool), `demora_minutos` (NO se pisa desde goya), `geojson`
(string JSON `[{lat,lng}]` con valores string), `created_at`, `updated_at`.

## Modelo de datos (Prisma, `prisma db push` como el resto del proyecto)

```prisma
model ZonaOperativa {
  id          Int       @id @default(autoincrement())
  puestoId    Int
  nombre      String    @db.VarChar(60)
  descripcion String?   @db.VarChar(200)
  color       String    @db.VarChar(9)
  tipoZona    String    @db.VarChar(15)  // DISTRIBUCION | FLETE (solo goya)
  servicios   String[]                   // URGENTE | SERVICE | NOCTURNO (solo goya)
  estado      String    @db.VarChar(10)  // ACTIVE | ARCHIVED
  poligono    Json                       // [{lat: number, lng: number}]
  trackZonaId Int?      @unique          // zona_id en Supabase track
  syncEstado  String    @db.VarChar(10) @default("PENDING") // SYNCED|PENDING|ERROR|NA
  syncedAt    DateTime?
  syncError   String?   @db.VarChar(300)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([puestoId])
  @@map("zona_operativa")
}

model PuestoEscenario {
  puestoId    Int @id
  escenarioId Int
  @@map("puesto_escenario")
}
```

## API NestJS (módulo `zonas`, patrón de `moviles`, AuthGuard)

- `GET  /zonas?puestoId=&tipoZona=&servicio=&search=&incluirArchivadas=`
- `GET  /zonas/puestos` — puestos activos con lat/lng saneados (Canelones las
  tiene invertidas en la base → si lat<-36 se swapea; sin coords → null y el
  front usa fallback).
- `POST /zonas` · `PATCH /zonas/:id` · `DELETE /zonas/:id` ·
  `POST /zonas/:id/duplicar`
- Sync:
  - `POST /zonas/sync/pull` — importa/actualiza desde track (GET
    `/api/zonas`), upsert por `trackZonaId`, escenario→puesto vía mapeo;
    escenarios sin mapeo se reportan como salteados. Sirve de carga inicial.
  - `POST /zonas/sync/push` — reintenta las `PENDING`/`ERROR`.
  - `POST /zonas/sync/webhook` — entrada para track (header `x-api-key`
    contra `ZONAS_SYNC_API_KEY`), upsertea por `trackZonaId`, sin re-eco.

## TrackSyncService (saliente, best-effort)

- La mutación commitea en goya SIEMPRE; el push a track es post-commit.
  Falla → `syncEstado: ERROR` + `syncError` (no bloquea al usuario).
- Puesto sin mapeo → `syncEstado: NA`, no se llama a track.
- Alta: `trackZonaId = max(zona_id en track) + 1` (leído de GET `/api/zonas`;
  goya es único escritor, sin carrera). Upsert PUT con
  `{zona_id, escenario_id, nombre, descripcion, color, activa, geojson}`.
- `activa = (estado === 'ACTIVE')`. Eliminar → DELETE `/api/import/zonas`
  con `zona_ids: [trackZonaId]`.
- Timeout 8s, header `x-api-key: TRACK_API_KEY`.

## Config nueva (`backend/.env`)

```
TRACK_API_URL=https://track.glp.riogas.com.uy
TRACK_API_KEY=<INTERNAL_API_KEY de track>
ZONAS_SYNC_API_KEY=<secreto nuevo para el webhook entrante>
```

## Frontend

- `src/services/zonas.ts`: mock → axios `/api/zonas/*` (mismas firmas).
- Tipos: `Zone.id` y `Puesto.id` pasan a `number`; `Puesto.lat/lng` nullable
  con fallback de centrado (Montevideo para 100, centro UY si no hay coords).
- Editor: indicador discreto si `syncEstado === 'ERROR'` (title con el error).
- `tipoZona`/`servicios` viven solo en goya (track no los conoce).

## Verificación

Typecheck, backend+front locales contra la base goya real, e2e de pantalla
(script Playwright existente adaptado), `sync/pull` real (read-only), y
round-trip de push: crear zona de prueba ARCHIVADA (activa:false, invisible
para ruteo), verificar en track vía GET `/api/zonas`, eliminarla (mirror
delete) y confirmar limpieza.
