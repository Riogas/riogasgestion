# Verificación de coordenadas + geoinversa de clientes (Goya)

**Fecha:** 2026-06-23
**Base:** sobre la migración Prisma/`goya` (ver `2026-06-23-clientes-goya-prisma-migracion-design.md`).

## Objetivo
Para todos los clientes con GPS: hacer **geoinversa** contra el Nominatim propio, obtener
calle + nº de puerta, **reconstruir la dirección completa** en un campo `direccion`, y marcar
con ✅/❌ en el panel si la calle de la geoinversa **coincide** con la que el cliente tenía.

## Endpoints propios
- Nominatim: `http://nominatim.riogas.uy/` (4.4.1, datos UY 2025-07-21). Probado OK.
- Overpass: `http://overpass.riogas.uy/` (reserva; con Nominatim alcanza para reverse).

## Datos (verificados en goya, 933.959 filas)
- Cobertura coordenadas: **ICA 97%** (UTM 21S, hay que reproyectar), **DIRCOR 85%** (mezcla
  lat/lng y UTM), **SAD 14%** (lat/lng WGS84 limpio, X=lat / Y=lon).
- `callePrincipalId` 100%, `numeroPuerta` 89%.
- Catálogo de calles: **`GXCALDTA.CALLE`** en AS400 → `CALID` (id) + `CALNOM` (nombre).

## Normalización de coordenadas (→ WGS84 lat/lng)
Cascada por cliente, primera que aplique:
1. **SAD** (`sadCoordenadaX`=lat, `sadCoordenadaY`=lon) si está en rango UY (lat ∈ [-35,-30], lon ∈ [-59,-53]).
2. **ICA** (`icaCoordenadaX/Y`, UTM 21S) → reproyectar con pyproj (EPSG:32721 → 4326).
3. **DIRCOR** (`coordenadaX/Y`): si |x|<90 es lat/lng (X=lat,Y=lon); si no, UTM 21S → reproyectar.
Resultado: `geoLat`, `geoLng`. Cobertura efectiva ~97%.

## Cambios en el esquema (Prisma / goya)
- **Tabla nueva `calle`**: `id Int @id`, `nombre String?`, `nombreIca String?`. Poblada del AS400.
- **`cliente`** — columnas nuevas:
  - `direccion String?` — dirección completa reconstruida.
  - `calleGeo String?`, `numeroPuertaGeo String?` — lo que devuelve la geoinversa.
  - `localidadGeo`, `departamentoGeo`, `cpGeo String?` — contexto de la geoinversa.
  - `calleMatch Boolean?` — el ✅/❌.
  - `matchScore Float?` — similitud 0-1 (debug).
  - `geoLat Decimal? @db.Decimal(10,7)`, `geoLng Decimal? @db.Decimal(10,7)` — coords usadas.
  - `geoFuente String?` — `sad|ica|dircor`.
  - `geoVerificadoAt DateTime?`.

## Construcción de `direccion`
Desde los componentes resueltos (no de la geoinversa): `CALNOM(callePrincipalId)` + `nº puerta`
+ `bis` + (`esq. CALNOM(calleEsquina1Id)` y CALNOM(calleEsquina2Id)) + `solar/block` + `apto`
+ `km` + localidad. Mínimo obligatorio: calle + nº. La geoinversa rellena calle/localidad cuando
el componente viejo no resuelve.

## Matching de calle
1. Normalizar ambas: minúsculas, sin acentos, sin prefijos (`calle/av/avenida/dr/gral/cno`),
   colapsar espacios.
2. `match = true` si: iguales normalizadas **o** ratio Levenshtein ≥ **0.85** **o** una contiene a la otra (≥4 chars).
3. Si el cliente **no tiene calle vieja resoluble** (callePrincipalId nulo/0 o sin CALNOM) → `match = true` (verde), per decisión del usuario.
4. Si tiene calle vieja pero NO coincide → `match = false` (❌).

## Procesamiento — backfill masivo re-ejecutable
Script Python (`backend/prisma/backfill_geo.py`, patrón del ETL existente):
- Lee de goya los clientes con coords (cascada), en lotes.
- Reverse geocode contra Nominatim propio (rate configurable, reintentos, timeout).
- Calcula direccion + calleGeo + match + score, `UPDATE` batcheado en goya.
- **Idempotente / re-ejecutable**; flag `--solo-pendientes` (geoVerificadoAt null) y `--limit N`.
- Extra: endpoint NestJS `POST /api/clientes/:id/verificar-geo` para "re-verificar" 1 cliente desde la ficha/panel.

## UI — panel `/dashboard/clientes`
- Columna nueva **"GPS"**: ✅ verde si `calleMatch=true`, ❌ rojo si `false`, gris si sin verificar.
- Tooltip: "Tenía: «X» · Geoinversa: «Y»".
- Filtro/stat: "con diferencia de calle" para auditar los ❌.

## Orden de ejecución
1. Estabilizar panel (2 errores TS) — la ficha rota queda como follow-up aparte (no bloquea dev).
2. Migrar catálogo `calle`.
3. `prisma db push` columnas nuevas.
4. Backfill script + validación con muestra → corrida completa.
5. Columna ✅/❌ en el panel.
