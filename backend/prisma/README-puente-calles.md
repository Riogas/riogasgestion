# Puente nomenclator ↔ OSM — operación

Spec: `docs/superpowers/specs/2026-08-11-nomenclator-osm-puente-design.md`

## Los scripts (corren en la máquina con jt400/Java para el AS400; los de OSM
## solo necesitan Python + red interna)

| Script | Qué hace | Cuándo |
|---|---|---|
| `etl_nomenclator.py` | AS400 GXCALDTA.{CALLE,CIUDAD,DEPTO} → goya (`calle` ampliada, `ciudad_nomenclator`, `depto_nomenclator`) + `cantClientesReal` local | on-demand (el nomenclator legacy cambia poco) |
| `extraer_calle_osm.py` | Overpass país completo → clustering → geoinversa (localidad+depto) → `calle_osm` | lo llama el refresco |
| `matching_calles.py` | Las tres pasadas (nombre/geometría/cruce) → `calle_match` + `reporte_matching.md`. Respeta CONFIRMADO_MANUAL/RECHAZADO | lo llama el refresco |
| `refresco_calle_osm.py` | Snapshot → re-extracción → diff (nuevas/renombradas/desaparecidas) → re-matching → log `DIFF` | **semanal (cron)** |

## Gotchas ganados con sangre

- **NO usar `area[admin_level=4]` de Overpass** para recortar por departamento:
  tras aplicar diffs, las áreas tocadas quedan pendientes de regeneración por
  horas y esos departamentos devuelven **0 ways** (pasó con Florida, Paysandú,
  Salto y Durazno el 2026-08-11). Se consulta el país entero y el depto sale
  de la geoinversa.
- **El límite de Colonia está roto en Nominatim** (el reverse no devuelve
  `state` ahí): fallback point-in-polygon con los límites bajados de Overpass.
- **La Ñ del AS400 viaja bien por jt400** (CCSID 284). El `�` histórico era
  del pipeline viejo. Salida siempre con `PYTHONIOENCODING=utf-8`.
- El nomenclator escribe números en palabras (`DIECIOCHO DE JULIO`); OSM usa
  cifras (`18 de Julio`). La conversión vive en `_normcalle.py` y en su port
  TS `backend/src/calles/normalizar.ts` — **si se toca uno, se toca el otro**.
- `CALID 47121 "SIN NOMBRE"` tiene 39k usos de clientes y NO es una calle:
  filtrado por `es_calle_real()`.

## Las APIs que sirven esto

`backend/src/calles/` (NestJS): `GET /api/calles/buscar|esquinas|resolver`
(header `x-api-key` = `CALLES_API_KEY`, o JWT del panel; `?formato=texto`
devuelve `campo|campo|…` por línea para el VB6) + `GET/PATCH /api/calles/matches*`
(pantalla `/dashboard/calles-match`).

## Cron sugerido (cuando se decida dónde corre)

```
# lunes 06:30 — refresco OSM + diff + re-matching
30 6 * * 1  cd <backend/prisma> && python refresco_calle_osm.py
```
