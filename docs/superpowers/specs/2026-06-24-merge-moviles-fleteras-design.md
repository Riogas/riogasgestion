# Merge unificado de Móviles y Empresas Fleteras — Diseño (estructura)

**Fecha:** 2026-06-24
**Estado:** En diseño (decisiones de fondo acordadas; pendiente revisión del usuario)
**Alcance de esta spec:** ESTRUCTURA (modelo Postgres unificado + ETLs desde los 2 AS400). El front (pantallas Empresa Fletera y Móviles) es una fase posterior.
**Relevamientos base:** `docs/superpowers/research/2026-06-24-moviles-PUESTOS.md` (interior) y `docs/superpowers/research/2026-06-24-moviles-GXCALDTA.md` (capital).
**Relacionados:** `2026-06-24-modelo-unificado-clientes-design.md` (mismo patrón origen/idOriginal; `cliente_uni`, catálogos `puesto`/`zona`).

## Objetivo

Unificar el ecosistema de **móviles** (vehículos de reparto) y **empresas fleteras** de los dos sistemas AS400 de Riogas (interior=`PUESTOS`, capital=`GXCALDTA`) en un único modelo en Postgres goya (192.168.2.117), con sus sub-dominios de configuración (zonas, horarios, servicios, bodega/stock, destinos, ICA) y la relación cliente↔móvil ligada al `cliente_uni` ya migrado. Sienta la base para luego construir las pantallas de gestión de fleteras y móviles.

## Jerarquía canónica

```
puesto  (catálogo ya existente en goya)
  └─< empresa_fletera          (interior: EFLPUESTOID real | capital: Montevideo id=100 + baseOperativa)
         └─< movil             (movil.fleteraId → empresa_fletera ; join origen: MOVEFLID→EFLID)
                ├─ estado       (movil.estadoCodigo → movil_estado[origen,codigo])
                ├─< movil_zona / movil_servicio / movil_bodega / movil_stock / movil_horario(+dia/excepcion)
                ├─ destino      (movil.destinoId → movil_destino ; solo capital)
                ├─< movil_ica   (móvil ↔ distribuidor ICA ; solo capital)
                └─< cliente_movil  (cliente_uni ↔ movil ; solo capital hoy)
```

## Decisiones acordadas con el usuario

1. **Independiente de TrackMovil.** El modelo unificado vive en **goya Postgres**, separado del modelo operativo de TrackMovil (Supabase). La sincronización/reconciliación con TrackMovil es una fase aparte (habrá duplicación temporal de móviles, aceptada).
2. **Ecosistema completo** (todos los sub-dominios de config/operación), **menos choferes** (diferidos).
3. **Histórico:** se modela la estructura pero **NO se migra el bulk** (`MOVHISTE` 3.2M, `MOVASOCR` 429k). Tablas creadas vacías; backfill aparte si se decide.
4. **Estados:** se **preservan los códigos originales por origen** (catálogo `movil_estado` con `origen`+`codigo`). Sin normalización a un set común en esta fase.
5. **cliente↔móvil:** integrado con `cliente_uni` (FK al cliente unificado, resolviendo el CLIID original).
6. **Puesto en capital:** todo capital cuelga del **puesto Montevideo (id=100)** (igual que clientes), y se preserva el usuario-puesto original (`EFLUSER`) como texto en `empresa_fletera.baseOperativa`. Interior usa su `MOVPUESTOID`/`EFLPUESTOID` real.
7. **Sin duplicados entre sistemas:** un móvil físico está en un solo sistema → **unión simple** con `origen`+`idOriginal`, sin dedup (a diferencia de clientes).

## Fuera de alcance (explícito)

- **Choferes:** `CHOFERES`/`CHOFERE1`/`CHOFERE2` (solo interior). Fase posterior.
- **Canal "App de pedidos":** `APPMOVI2/3/4/5`, `APPMOVMS` (capital) — son toma de pedidos web/WhatsApp/Messenger, **no** vehículos. Homónimo.
- **Tarifa de flete (costo):** `FLETE`/`FLETELEV`/`FLETE0001` (capital), `FLETES` (interior) — dominio financiero "costo de entrega", **no** vehículo. Homónimo.
- **GPS / telemetría:** `CELSINFO` (120k), `CELSLOGS`, `GPSS`, `gps_latest_positions` (TrackMovil), webhook n8n. Subsistema externo; se referencia por id (`gpsMovId`) pero no se migra.
- **Auditoría GeneXus:** `AMOVILES`, `AMOVZONA`, `AMOVICAM`, `GXA0034`. Se usa la tabla viva como verdad.
- **Bulk de histórico:** `MOVHISTE`, `MOVASOCR` (solo estructura).
- **Sincronización con TrackMovil** y **el front** (pantallas) — fases aparte.

## Datos / volúmenes (verificados 2026-06-24)

| Entidad | Interior (PUESTOS) | Capital (GXCALDTA) | Unificado (aprox) |
|---|---|---|---|
| empresa_fletera | 90 | 132 | 222 |
| movil | 100 | 416 | 516 |
| movil_estado (catálogo) | 4 | 8 | 12 |
| movil_zona | — | 537 | 537 |
| movil_servicio | — | 1.511 | 1.511 |
| movil_bodega | 0 (vacía) | 329 | 329 |
| movil_stock | — | 308 | 308 |
| movil_horario / _dia / _excepcion | — | 57 / 372 / 2 | 431 |
| movil_destino | — | 256 | 256 |
| movil_ica | — | 304 | 304 |
| cliente_movil | — | 507 | 507 |
| movil_historico (estructura, sin datos) | — | (3.2M) | 0 migradas |

> El interior aporta **solo el núcleo** (móvil + fletera + estado); los sub-dominios ricos (zonas/horarios/servicios/stock/destinos/ICA/cliente↔móvil) hoy existen solo en capital. Las tablas quedan listas para datos de interior cuando existan.

## Modelo Postgres (Prisma) — `backend/prisma/schema.prisma`

Patrón: PK surrogate `id @default(autoincrement())`, `origen` (`interior`|`capital`), `idOriginal` (PK del AS400), `@@unique([origen, idOriginal])`. Coords capital en UTM 21S (EPSG:32721) → WGS84 en el ETL (igual que clientes). Tablas `@@map` en snake_case.

### empresa_fletera (`EFLETERA` interior + capital)
```
id, origen, idOriginal(EFLID), puestoId(FK puesto),
baseOperativa?  // capital EFLUSER (PSTCENTRO…); interior null
nombre(EFLNOM), nombreComercial?(capital EFLNOMCOMO), razonSocial?(interior EFLRAZONSOCIAL),
ruc(EFLRUC), direccion?(interior EFLDIRECCION txt | capital EFLCALID+EFLNROPUER resuelto),
telefono(EFLTEL), email(EFLMAIL), estado(EFLESTADO A/P), observaciones?(EFLOBS),
gpsId?(interior EFLGPSEFLETERA), createdAt, updatedAt
@@unique([origen, idOriginal]); relations: moviles Movil[]
```

### movil (`MOVILES` interior + capital)
```
id, origen, idOriginal(MOVID),
fleteraId?(FK empresa_fletera; resuelve MOVEFLID→(origen,idOriginal); 1 interior queda null),
puestoId?(FK puesto; interior MOVPUESTOID | capital 100),
estadoOrigen, estadoCodigo(FK movil_estado[origen,codigo]; interior MOVESTCOD | capital MOVESTCOD),
descripcion?(interior MOVDSC/MOVDESCRIPCION | capital V_MOVACT.SERVICIOPRINCIPAL/nombre),
marca?(MOVMARCA), modelo?(MOVMODELO), matricula?(MOVMAT), telefono?(MOVTELFNRO),
capacidadLote?(interior MOVBOD13TOPE | capital MOVT1/MOVT2 tamaño-lote),
servicioPrincipalTxt?(interior MOVSERVPRINCIPAL | capital MOVTPOSERI), tipoServicio?(capital MOVTPOSERI),
rutea?(capital MOVRUTEA S/N), pedidosPendientes?(capital MOVPEDPEND | interior MOVPEDLOTE),
lat?, lng?(interior MOVULTCOORDX/Y dec | capital MOVX/MOVY o MOVACTENX/Y UTM→WGS84),
ultPosicionAt?(capital MOVPOSFCHA | interior MOVULTMODIFICACION),
gpsMovId?(interior MOVGPSMOVID | capital MOVGPS), tieneGps?, gpsReportando?(capital MOVGPSOK),
distanciaMaxMts?(interior MOVDISTANCIAMAXMTSCUMPPEDIDOS),
appPuedeDesactivar?(interior MOVAPPPUEDEDESACTIVAR), permiteBajaMomentanea?(interior MOVPERMITEBAJAMOMENTANEA),
destinoId?(FK movil_destino; capital MOVDESTID), nroMovil?(interior MOVNROMOVIL),
activoDesde?, activoHasta?(capital MOVACTDESD/MOVACTHAST), observaciones?(interior MOVOBS),
firebaseEnviado?, firebaseEliminado?(interior), createdAt, updatedAt
@@unique([origen, idOriginal]); @@index([fleteraId]); @@index([puestoId])
relations: zonas, servicios, bodega, stock, horarios, ica, clientes, historico
```

### movil_estado (catálogo, `MOVESTADO` interior + `MOVESTAD` capital)
```
id, origen, codigo(MOVESTCOD), nombre(MOVESTNOM), actividad?(interior MOVESTACT | capital MOVESTICA)
@@unique([origen, codigo])
// interior: 1 ACTIVO/2 INACTIVO/3 NO TRABAJA MAS/4 NO RECIBE PEDIDOS
// capital: 0 ACTIVO ESPERA … 15 NO TRABAJA MAS (8 estados, ver research §4)
```

### movil_zona (`MOVZONAS` capital)  — M:N móvil↔zona
```
id, movilId(FK movil), origen, escenarioId(ESCID), canalId(ESCCANALID),
zonaId(ESCZONAID), tipo(ESCZONTPO), flag?(ESCZONFLAG)
@@index([movilId]); @@index([zonaId])
```

### movil_servicio (`MOVSERV` capital) — M:N móvil↔servicio
```
id, movilId(FK movil), origen, servicioCodigo(MOVSERID)  // sin catálogo nombre (ver ambigüedad #1)
@@index([movilId])
```

### movil_bodega (`MOVBODEG` capital / `MOVBODEGALEVEL1` interior vacía) — capacidad por producto
```
id, movilId(FK movil), origen, productoEmpresa?(MOVPRODEMP), productoCodigo(MOVPRODCOD),
capacidad(MOVBODEGA), sinActivar?(MOVBODSINA), fecha?(MOVBODFCH)
```

### movil_stock (`MOVSTOCK` capital) — stock a bordo
```
id, movilId(FK movil), origen, productoEmpresa?(MOVPRDEMPC), productoCodigo(MOVPRDCOD),
stockMovil(MOVPRDSTKM), stockOcupado?(MOVPRDSTKO), tiempoCarga?(MOVPRDTIEC), tiempoDesc?(MOVPRDTIED)
```

### movil_cantidad_objetivo (`MOVCANTX` capital) — planificación
```
id, origen, escenario(MOVCANTESC), zona(MOVCANTZON), servicio(MOVCANTSER),
cantidad(MOVCANTCAN), flag?(MOVCANTFLA)
```

### movil_horario / movil_horario_dia / movil_horario_excepcion (`MOVHORAR/1/2` capital)
```
movil_horario:        id, movilId(FK), origen, vigDesde(MOVHORFCHV), vigHasta(MOVHORFCHF),
                      dias?(MOVHORSDIA), observaciones?(MOVHOROBS), usuario?(MOVHORUSUA)
movil_horario_dia:    id, horarioId(FK movil_horario), diaId(DIAID 1-7),
                      horaDesde(DIAHORDESD), horaHasta(DIAHORHAST)
movil_horario_excepcion: id, horarioId(FK), horaDesde?(MOVHEHORDE), horaHasta?(MOVHEHORHA),
                      observaciones?(MOVHEOBS), fecha?(MOVHEFCHAL)
```

### movil_destino (`MOVDESTI` capital) — puntos de reubicación
```
id, origen, idOriginal(MOVDESTID), nombre(MOVDESTNOM),
lat?, lng?(MOVDESTX/Y UTM→WGS84), direccion?(MOVDESTOBS)
@@unique([origen, idOriginal])
```

### movil_ica (`MOVICAMO` capital) — móvil ↔ distribuidor ICA
```
id, movilId(FK movil), origen, distribuidorId(DISTID)
@@index([movilId])
```

### cliente_movil (`CLIMOVIL` capital) — cliente↔móvil preferido
```
id, clienteId(FK cliente_uni; resuelve CLIID→(origen='capital', idOriginal=CLIID)),
movilId(FK movil; CLIMOVID), prioridad(CLIMOVPRIO), origen
@@index([clienteId]); @@index([movilId])
// CLIID=0 (genérico) → clienteId null
```

### movil_historico (`MOVHISTE` capital) — ESTRUCTURA ONLY (sin bulk)
```
id, movilId(FK movil), origen, fecha(MOVHISEFCH), accion(MOVHISEST),
usuario?(MOVHISTUSE), detalle?(MOVHISTDSC)
// tabla creada vacía; backfill de 3.2M aparte si se decide
```

## ETLs (`backend/prisma/`, Python jaydebeapi+psycopg2, reusan `_creds`, idempotentes)

Orden (respeta FKs):
1. `etl_movil_estados.py` — `MOVESTADO`(interior)+`MOVESTAD`(capital) → `movil_estado`.
2. `etl_fleteras.py` — `EFLETERA`(interior+capital) → `empresa_fletera`. Capital: `puestoId=100`, `baseOperativa=EFLUSER`, resolver `direccion` desde `EFLCALID`+`EFLNROPUER` vía catálogo `calle`. Interior: `puestoId=EFLPUESTOID`.
3. `etl_movil_destinos.py` — `MOVDESTI`(capital) → `movil_destino` (UTM→WGS84).
4. `etl_moviles.py` — `MOVILES`(interior+capital) → `movil`. Resolver `fleteraId` vía `(origen, idOriginal=MOVEFLID)`; huérfano interior → null + log. Capital `puestoId=100`. Coords UTM→WGS84. `destinoId` vía `(origen, idOriginal=MOVDESTID)`.
5. Sub-dominios capital (dependen de `movil`): `etl_movil_zonas.py`, `etl_movil_servicios.py`, `etl_movil_bodega_stock.py`, `etl_movil_horarios.py`, `etl_movil_ica.py`, `etl_movil_cantidades.py`.
6. `etl_cliente_movil.py` — `CLIMOVIL`(capital) → `cliente_movil`. Resolver `clienteId` vía `cliente_uni(origen='capital', idOriginal=CLIID)`; `CLIID=0`→null; `movilId` vía `(origen='capital', idOriginal=CLIMOVID)`.
7. `movil_historico` — crear tabla, NO ejecutar bulk.

Cada ETL: `DELETE WHERE origen=...` antes de insertar (re-ejecutable), `execute_values` en lotes, log de huérfanos/saltados.

## Manejo de bordes

- **Fletera huérfana (interior, 1 móvil):** `fleteraId=null` + log. No se crea fletera placeholder.
- **CLIID=0 en CLIMOVIL:** `clienteId=null` (móvil genérico/sin cliente).
- **Coords capital:** preferir `MOVACTENX/Y` (posición actual) si válidas; fallback `MOVX/Y`. Validar rango Uruguay (igual criterio que clientes) antes de convertir; fuera de rango → null.
- **`MOVSERV.MOVSERID` sin catálogo de nombre:** se guarda el código; el nombre se resuelve en una fase posterior (ver ambigüedad #1).
- **`MOVASOCR` (sin columna móvil clara):** NO se modela en esta fase (ver ambigüedad #2).
- **Campos `MOVAUX*`/`MOVEXT*` genéricos GeneXus:** se omiten (mayormente vacíos); se revisan si surge necesidad.

## Verificación

- `npx prisma db push` (o migrate) crea todas las tablas sin error.
- Post-ETL: counts por tabla coinciden con los volúmenes esperados (±huérfanos logueados). Ej.: `empresa_fletera`=222, `movil`=516, `movil_estado`=12, `movil_zona`=537, `cliente_movil`≤507 (CLIID=0 → null).
- Spot-check de joins: `movil` con `fleteraId` no nulo resuelve a `empresa_fletera` correcta; `cliente_movil.clienteId` resuelve a `cliente_uni`.
- Conversión de coords: muestra de móviles capital con lat/lng en rango Uruguay.

## Ambigüedades abiertas (a resolver durante implementación / con negocio)

1. **`MOVSERV.MOVSERID` → nombre de servicio:** el catálogo de tipos de servicio no está en las tablas MOV*; probablemente en otra librería/tabla (`SERVICIO`?). Se migra el código; el nombre queda pendiente.
2. **`MOVASOCR`:** las 3 columnas vistas (FCHI/OPER/FCHF) no incluyen `MOVID` explícito. Confirmar cómo liga al móvil antes de modelarla (excluida por ahora).
3. **Espacio de ids de zona:** `MOVZONAS.ESCZONAID` (capital) vs el catálogo `zona` ya migrado (280, per-puesto). Confirmar si comparten id-space o requieren mapeo antes de poner FK dura (por ahora `zonaId` sin FK forzada).
4. **Redundancia puesto↔fletera:** `movil.puestoId` (de `MOVPUESTOID`) puede no coincidir con el puesto de su fletera. Se conservan ambos; verificar consistencia.
5. **`EFLESTADO`/`estado` `A`/`P`:** significado de `P` (¿pendiente? ¿pasivo?) a confirmar con negocio (se guarda crudo).
6. **Coords capital `MOVX/Y` vs `MOVACTENX/Y`:** confirmar cuál es la "última posición" operativa.
7. **Descripciones GeneXus ausentes en DB2** (TABLE_TEXT/COLUMN_TEXT NULL): semántica fina inferida de nombres+samples; validar con usuario funcional.

## Fases siguientes (NO en esta spec)

1. Front: pantallas Empresa Fletera y Móviles (la lista/CRUD; el menú goya ya tiene `empresafletera` y `moviles` placeholder).
2. Sync/reconciliación con TrackMovil (Supabase) — operativa de ruteo/GPS.
3. Choferes (interior) + asignación chofer↔móvil.
4. Backfill de histórico (`MOVHISTE`) si se requiere.
5. Normalización de servicios (`MOVSERID`→catálogo) y de estados (set común) si se decide.
