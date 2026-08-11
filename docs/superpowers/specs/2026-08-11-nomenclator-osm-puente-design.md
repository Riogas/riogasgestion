# Puente nomenclator ↔ OSM — diseño

**Fecha:** 2026-08-11
**Estado:** para revisión del usuario antes de implementar

## Objetivo

Que convivan los dos métodos de direcciones:

- El **nomenclator legacy** (AS400 GXCALDTA: `CALLE`/`CIUDAD`/`DEPTO`), que el VB6 usa hoy y
  cuyos `CALID` están guardados en clientes y pedidos. **El AS400 no se toca**: solo lectura.
- El **catálogo vivo de OSM** (Nominatim + Overpass propios), que se actualiza solo.

El puente vive en el **Postgres de goya** (nuestro terreno) y se expone por **goya-backend**.
La regla de convivencia: las APIs nuevas devuelven, además del nombre OSM, el **CALID del
nomenclator**, así el VB6 adopta el suggest nuevo y sigue guardando CALID como siempre. Para
volver al método viejo no hay que deshacer nada.

## Lo relevado (2026-08-11, todo verificado contra los sistemas reales)

### AS400 GXCALDTA (solo lectura, por jt400)

- **13.170 calles, 81 ciudades, 20 deptos, 936.889 clientes.**
- `CALLE`: `CALID` (PK), `CALNOM` (40), **`EXCALNOM` — el nomenclator ya registra el nombre
  anterior** (722 calles lo tienen), `CIUID` (calle colgada de ciudad), `CALCANTCLI` (conteo
  de clientes, **verificar frescura** — `CIUDAD.CIUCANTCLI` está claramente desactualizado),
  `CALVISIBLE` (estados `S`=12.551, `V`=248, `J`=226, `P`=125, `N`=20 — semántica a confirmar),
  `CALCODICA`/`CALNOMICA`/`CALTRAMICA` (referencias al software de segmentación viejo),
  `CALCORDX/Y` (UTM 21S, muchas en 0).
- `CLIENTE`: `CALPRINID`, **`CALESQ1ID`, `CALESQ2ID`** (las esquinas de hoy también son CALID
  — la API nueva de esquinas debe devolver CALID de las esquinas, no solo nombres),
  `NROPUERTA`, `BIS`, `APTO`, `NROMANZ`, `KM`, más tres pares de coordenadas.
- **Encoding: CCSID 284 y la Ñ viaja perfecta por jt400** (`ÑANDUBAY`). El `�` de la migración
  anterior fue del pipeline, no del AS400. El ETL nuevo va por jaydebeapi con salida UTF-8.
- Detalle de matching: el nomenclator escribe números en palabras — `AVENIDA DIECIOCHO DE
  JULIO` vs OSM `18 de Julio`. Y hay formatos `A LAS PIEDRAS,CNO. (PROGRESO)`: abreviatura
  al final y localidad entre paréntesis.

### Postgres goya (192.168.2.117/goya)

- `calle` (migrada 2026-06-23): 13.170 filas, solo `id`/`nombre`/`nombreIca` — **sin
  ciudad/depto** → se re-importa ampliada.
- `cliente` (933.959): ya tiene `callePrincipalId`, `calleEsquina1Id/2Id`, `numeroPuerta`,
  `geoLat/geoLng`, `calleGeo`, `direccion` → **conteos por calle y matching geométrico se
  hacen 100 % local**, sin AS400.
- Extensiones `unaccent`, `pg_trgm`, `fuzzystrmatch` disponibles (instalar con
  `CREATE EXTENSION`). PostGIS no está — la geometría se resuelve en el job (Python), no en SQL.

### OSM propio

- Depto de Montevideo: 14.182 tramos → **4.767 nombres únicos** (vs **4.824** calles del
  nomenclator para CIUID 1 — los dos universos son casi del mismo tamaño, buen augurio).
- `18 de Julio` en Canelones: 51 tramos → la dedup por `(depto, localidad, nombre)` es
  obligatoria.
- **255.108 portales** con número de puerta en Montevideo (import IMM).
- Réplicas **arregladas hoy**: Overpass poniéndose al día (DNS del contenedor roto desde
  abril — recreado con `dns:` explícito), Nominatim con réplica inicializada (nunca la tuvo:
  placeholder `__REPLICATION_URL__` sin sustituir) + cron cada 6 h. Gotchas en el registro
  de infra.

## Modelo de datos (todo en goya)

```
calle            (ampliar la existente, aditivo)
  + ciuId, depId          ← CIUID/DEPID
  + exNombre              ← EXCALNOM
  + visible               ← CALVISIBLE
  + cantClientesAs400     ← CALCANTCLI (informativo)
  + cantClientesReal      ← COUNT local sobre cliente (prin + esq1 + esq2)
  + codIca, tramoIca      ← CALCODICA/CALTRAMICA (trazabilidad segmentación vieja)
  + cordX, cordY          ← CALCORDX/Y (UTM 21S)

ciudad_nom (81)  ← CIUDAD: ciuId, depId, nombre, nombreAbre, estado
depto_nom  (20)  ← DEPTO

calle_osm        (extracción deduplicada del país)
  id, nombre, nombreNorm, departamento, localidad,
  variantes jsonb  [{tipo: 'old'|'alt'|'short', nombre}]   ← "si tuvo 2 nombres, ambos"
  latCentro, lngCentro, osmWayIds bigint[], extraidoAt

calle_match      (el puente, M:N a propósito)
  calleId → calle.id (CALID)  |  calleOsmId → calle_osm.id
  score numeric, metodo enum(EXACTO|FUZZY|GEOMETRICO|MANUAL)
  estado enum(AUTO_CONFIRMADO|A_REVISAR|RECHAZADO|CONFIRMADO_MANUAL)
  clientesCant int (para priorizar), detalle jsonb (evidencia: scores, distancias)
  revisadoPor, revisadoAt
```

Sin match también se representa: una calle del nomenclator sin fila en `calle_match` es
`SIN_MATCH_OSM`; una `calle_osm` sin fila es calle nueva que el nomenclator no conoce.

## El matching, en tres pasadas

**1. Por nombre.** Normalización agresiva de ambos lados: `unaccent` + mayúsculas + expansión
de abreviaturas (`CNO`→CAMINO, `AVDA/AV`→AVENIDA, `BVAR/BULEVAR`→BOULEVARD, `GRAL`, `DR`,
`PJE`…) + **números en palabras ↔ cifras** (DIECIOCHO↔18, OCHO DE OCTUBRE↔8 DE OCTUBRE) +
reordenar el formato `X,CNO.` + extraer el `(LOCALIDAD)` del paréntesis como pista. Se compara
contra el nombre canónico de OSM **y sus variantes** (`old_name` atrapa renombres) **y contra
`EXCALNOM`** en la otra dirección. Exacto → score 1; si no, fuzzy (rapidfuzz `token_sort` +
`pg_trgm`), siempre dentro del mismo scope depto/ciudad↔localidad.

**2. Por geometría — los clientes son la piedra Rosetta.** Para cada CALID, la nube de
`geoLat/geoLng` de sus clientes (ya está en goya); la calle OSM cuya polilínea minimiza la
distancia mediana a esa nube es candidata **aunque el nombre no se parezca en nada**. Es el
método que encuentra los renombres que el fuzzy no puede. `CALCORDX/Y` (reproyectada de UTM
21S) suma señal cuando existe.

**3. Cruce.** Nombre y geometría coinciden → `AUTO_CONFIRMADO`. Discrepan, o solo hay señal
débil → `A_REVISar` con la evidencia en `detalle`. La cola de revisión se ordena por
`clientesCant` **calculado local** (no confiar en `CALCANTCLI` sin verificar), contando
también el uso como esquina.

## APIs en goya-backend

| Endpoint | Qué hace |
|---|---|
| `GET /api/calles/buscar?q=&depto=&ciudad=` | Suggest deduplicado, **unión de fuentes**: calles OSM (con CALID vía match) + calles del nomenclator sin match OSM (con su CALID directo), cada ítem con `fuente` y `matchEstado`. Busca por nombre, variantes y sin tildes. Servido desde memoria: <5 ms. |
| `GET /api/calles/esquinas?calle=&numero=&depto=&ciudad=` | Nominatim estructurado + Overpass (módulos ya probados en la app direcciones, ~350 ms sin caché) → punto + `esquina1/2` **con nombre OSM y CALID de cada esquina** (reverse-match), para que el VB6 pueda guardar `CALESQ1ID/CALESQ2ID`. |
| `GET /api/calles/resolver?nombreOsm=&localidad=` | Nombre OSM → registro completo con CALID (el "buscando por nombre de calle de osm, devuelva todo"). |
| CRUD `/api/calles/matches` | Para la pantalla de revisión. |

Formato dual: JSON y `?formato=texto` (líneas `campo|campo|campo`) para que el VB6 lo parsee
con `Split()`. Todo por **http interno** — sin TLS para no pelear con Windows viejos.

## Pantalla de revisión (panel goya)

`/dashboard/calles-match`: cola ordenada por clientes desc; cada fila muestra nomenclator vs
candidato OSM con score y evidencia, mapita al lado (react-leaflet, patrón zonificación) con
la nube de clientes y la calle OSM pintada; acciones aprobar / corregir (elegir otra calle
OSM) / marcar sin-match. Registro en secapi como los demás puntos de menú.

## Job de refresco (el reemplazo del "proceso" viejo)

Semanal: re-extrae `calle_osm` de Overpass (país entero, ~15 s de consultas) → diff contra la
versión anterior → recalcula matches afectados → reporte: calles OSM nuevas / renombradas /
desaparecidas, matches rotos, y re-sincroniza `calle`/`ciudad_nom` desde el AS400 (por si el
nomenclator también se movió). Deja todo en una tabla de log visible desde la pantalla.

## Fases

1. **ETL**: re-import CALLE/CIUDAD/DEPTO ampliado + conteos reales locales. *(≈1 día)*
2. **Extracción OSM**: `calle_osm` país completo con variantes y dedup. *(≈1 día)*
3. **Matching** tres pasadas + clasificación + reporte inicial con % por tramo de clientes.
   *(2-3 días — acá se ve el match-rate real por primera vez)*
4. **APIs** suggest/esquinas/resolver + caché. *(1-2 días)*
5. **Pantalla** de revisión. *(2 días)*
6. **Job semanal** + diff report. *(1 día)*

Con corte de control después de la fase 3: el reporte de match-rate decide cuánta revisión
manual hace falta antes de soltar las APIs.

## Criterios de aceptación

- Matching corrido sobre las 13.170 calles; **top-1000 por clientes con estado resuelto**
  (auto o revisado) antes de exponer las APIs al VB6.
- Suggest: < 50 ms servidor para prefijos de 3+ letras, deduplicado (una fila por calle en
  Montevideo).
- Esquinas: < 500 ms sin caché en Montevideo, con CALID de ambas esquinas cuando existan;
  campos vacíos, jamás inventados.
- `18 de Julio` en Canelones aparece **una vez por localidad**, no 51.
- El job semanal corre y produce el diff sin intervención.

## Fuera de alcance

- Escribir en el AS400 (el VB6 sigue guardando CALID como hoy).
- Modificar el VB6 (consume las APIs; eso es de otro equipo).
- Migrar los CALID históricos de clientes/pedidos a otra cosa.
- OSRM y ruteo.
