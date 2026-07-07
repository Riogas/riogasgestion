# Implementación: Merge unificado Móviles y Empresas Fleteras (estructura + datos)

## Estado
✅ Completa (con 2 desviaciones menores documentadas, ambas conformes al criterio "research manda")

## Tareas completadas (M1..M8)
- **M1** Modelos Prisma (nombres amigables) + back-relation `movilesPreferidos` en `ClienteUni` + `db push`.
- **M2** ETL catálogos: `etl_movil_estados.py`, `etl_servicios.py`.
- **M3** ETL `etl_fleteras.py` (interior+capital).
- **M4** ETL `etl_movil_destinos.py` (capital, UTM→WGS84).
- **M5** ETL `etl_moviles.py` (maestro interior+capital).
- **M6** ETLs subdominios capital: zonas, servicios, bodega/stock, horarios(+día/excepción), ica, cantidades.
- **M7** ETL `etl_cliente_movil.py` (ligado a `cliente_uni`).
- **M8** Verificación de counts + joins + coords. `git push origin dev` OK.

## Archivos nuevos
| Archivo | Propósito |
|---------|-----------|
| `backend/prisma/_movhelp.py` | Helpers compartidos (conexión AS400/PG, coords UTM/grados, coerciones) |
| `backend/prisma/etl_movil_estados.py` | `movil_estado` (interior MOVESTADO + capital MOVESTAD) |
| `backend/prisma/etl_servicios.py` | `servicio` (GXCALDTA.SERVICIO) |
| `backend/prisma/etl_fleteras.py` | `empresa_fletera` |
| `backend/prisma/etl_movil_destinos.py` | `movil_destino` |
| `backend/prisma/etl_moviles.py` | `movil` (maestro) |
| `backend/prisma/etl_movil_zonas.py` | `movil_zona` |
| `backend/prisma/etl_movil_servicios.py` | `movil_servicio` |
| `backend/prisma/etl_movil_bodega_stock.py` | `movil_bodega` + `movil_stock` |
| `backend/prisma/etl_movil_horarios.py` | `movil_horario` + `_dia` + `_excepcion` |
| `backend/prisma/etl_movil_ica.py` | `movil_ica` |
| `backend/prisma/etl_movil_cantidades.py` | `movil_cantidad_objetivo` |
| `backend/prisma/etl_cliente_movil.py` | `cliente_movil` |

## Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `backend/prisma/schema.prisma` | +16 modelos móviles/fleteras; back-relation en `ClienteUni`; `MovilEstado.actividad` VarChar(4)→VarChar(40) |

## Verificaciones
- `npx prisma validate`: ✅
- `npx prisma db push`: ✅ (sin `--accept-data-loss`; datos de clientes intactos)
- ETLs: ✅ todos corrieron, idempotentes (`DELETE WHERE origen=...`)

## Counts reales vs esperados
| Tabla | Real | Esperado |
|---|---|---|
| empresa_fletera | 222 | 222 ✅ |
| movil | 516 | 516 ✅ |
| movil_estado | 12 | 12 ✅ |
| servicio | 61 | count(SERVICIO)=61 ✅ |
| movil_zona | 542 | ≈537 ✅ (fuente real 542, 0 saltados) |
| movil_servicio | 1511 | 1511 ✅ |
| movil_bodega | 329 | 329 ✅ |
| movil_stock | 308 | 308 ✅ |
| movil_horario / _dia / _excepcion | 57 / 372 / 2 | 57 / 372 / 2 ✅ |
| movil_destino | 256 | 256 ✅ |
| movil_ica | 304 | 304 ✅ |
| movil_cantidad_objetivo | 218 | 218 ✅ |
| cliente_movil | 507 | ≤507 ✅ (504 con clienteId, 3 CLIID=0→null) |
| movil_historico | 0 | 0 ✅ (solo estructura) |

Spot-checks de joins OK: movil→empresa_fletera, cliente_movil→cliente_uni, movil_servicio→servicio (0 sin servicioId). Coords capital en rango Uruguay: 324 móviles.

## Huérfanos / saltados logueados
- **movil interior:** 1 móvil (MOVID 62, MOVEFLID 0) → `fleteraId=null` + log (decisión spec: no placeholder).
- **cliente_movil:** 3 filas con CLIID=0 → `clienteId=null`; 0 sin móvil; 0 CLIID sin resolver.
- **movil capital coords:** 416−324=92 sin coord válida (MOVX/Y nula o fuera de rango UY) → lat/lng null.
- **movil_servicio:** 0 MOVSERID sin catálogo (todos resuelven a `servicio`).

## Desviaciones del plan (research manda)
1. **`MovilEstado.actividad` VarChar(4) → VarChar(40):** el plan asumió un flag corto, pero capital `MOVESTAD.MOVESTICA` es texto ("ACTIVO"/"PASIVO"/"NO ACTIVO MOMENTANEAMENTE"…) hasta ~24 chars. Se amplió el campo (cambio aditivo, re-`db push`).
2. **Columnas reales capital MOVILES:** la fletera es `EFLID` (no `MOVEFLID`); capital no tiene `MOVGPSMOVID`/`MOVNROMOVIL`/firebase/distancia/flags-app → quedan null. `capacidadLote=MOVT1`, `descripcion=MOVDSC`, `tipoServicio`/`servicioPrincipal=MOVTPOSERI` (según plan). Anotado en comentarios del ETL.
3. **Horarios ligados por `(MOVID, MOVHORFCHV)`** (PK real del cabezal MOVHORAR), no por índice posicional. `MOVHORSDIA` es DECIMAL (nº de días) → se guarda como texto en `dias`.
4. **`movil_zona.flag` y `movil_cantidad_objetivo`:** `ESCZONFLAG` es DECIMAL(1) → string; counts reales 542/218.

## Notas para el reviewer
- `_movhelp.py` centraliza la conversión de coords: `utm_to_latlng` (capital MOVX/Y, reproyecta) vs `grados_to_latlng` (interior MOVULTCOORDX/Y, ya en grados, NO reproyecta) — verificar que el criterio de rango Uruguay sea el deseado (lat −35.5..−30, lng −59..−53).
- Truncados intencionales por límite de columna: `nombreComercial` (EFLNOMCOMO CHAR60→VarChar40), `productoCodigo` (CHAR20→VarChar15), `direccion` destino (CHAR200→VarChar120). Si se quiere preservar full, ampliar el campo.
- `movil_zona.zonaId` sin FK dura (id-space capital vs catálogo `zona` per-puesto sin confirmar — ambigüedad #3 del spec).

## Notas para el tester
- Idempotencia: re-correr cualquier ETL no duplica (DELETE por origen/tabla). Probar doble corrida de `etl_moviles.py` (cascade borra hijos) seguido de los subdominios.
- `movil_historico` queda vacío por diseño (bulk MOVHISTE 3.2M NO migrado).
- Priorizar: join cliente_movil→cliente_uni para los 3 CLIID=0; conversión de coords de móviles capital fuera de rango (92 nulos) — confirmar si esperado.

## Pendiente / revisión humana
- `movil_zona.zonaId` id-space (FK a `zona`) — confirmar con negocio antes de FK dura.
- Backfill histórico `MOVHISTE` (diferido).
- Normalización de servicios interior (`MOVSERVPRINCIPAL` texto libre) y estados a set común (fase posterior).
- Front (pantallas Empresa Fletera / Móviles) — fase aparte.
