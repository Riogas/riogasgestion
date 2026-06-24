# Inventario ecosistema MÓVILES / EMPRESAS FLETERAS — esquema AS400/DB2 `PUESTOS` (interior Riogas)

**Fecha:** 2026-06-24
**Tipo:** Discovery solo-lectura (NO se modificó nada en AS400). Insumo para diseñar merge a Postgres.
**Conexión:** jaydebeapi / AS400JDBCDriver, credenciales `backend/.env` vía `_creds.as400()`.

> NOTA IMPORTANTE: en este sistema GeneXus **`TABLE_TEXT` y `COLUMN_TEXT` vienen VACÍOS / `NULL`** en `QSYS2.SYSTABLES` / `QSYS2.SYSCOLUMNS`. No hay descripciones en español en el catálogo. El propósito se infiere de los nombres de columna (convención GeneXus: prefijo de 3 letras = entidad) y de las filas de muestra.

---

## 0. Resumen del descubrimiento

Tablas que matchean `%MOV%` / `%FLET%` en el nombre (PUESTOS):

| Tabla | Tipo | Rol |
|---|---|---|
| `MOVILES` | T | **Maestro de móviles** (vehículos de reparto) |
| `EFLETERA` | T | **Maestro de empresas fleteras** |
| `MOVESTADO` | T | Catálogo de estados de móvil |
| `MOVBODEGALEVEL1` | T | Stock/bodega por móvil (subtabla; vacía hoy) |
| `FLETES` | T | **Tarifario de flete por ZONA** (no es del móvil; ver §6) |
| `GXA0034` | T | **Tabla de auditoría GeneXus** (snapshot histórico de `MOVILES`) |

Tablas que **referencian** móvil/fletera por columna (sin `MOV/FLET` en el nombre, o relacionadas):

| Tabla | Columna(s) relevante(s) | Rol |
|---|---|---|
| `CHOFERES` | `CHFEFLID`, `CHFPUESTOID` | Maestro de choferes (liga a fletera y puesto) |
| `CHOFERE1` | `CHFID`, `MOVID`, `MOVDEF` | **N:M chofer ↔ móvil** (asignación, con flag default) |
| `CHOFERE2` | — | (variante/índice de CHOFERE; no inspeccionada a fondo) |
| `PEDIDOS` | `PEDMOVIL`, `PEDMOVEFLID`, `PEDIMPORTEFLETE` | Pedido entregado por un móvil/fletera, con importe de flete |
| `PUESTOS` | `PUESTOGPSEFLETERA`, `PUESTOFLETECOBRA`, `PUESTOFLETECANTIDAD` | Config de flete a nivel puesto |
| `ZONA` | `ZONFLETECOBRA`, `ZONFLETECANTIDAD` | Config de flete a nivel zona |
| `CLIENTE` | `CLIFLETECOBRA`, `CLIFLETECANTIDAD` | Config de flete a nivel cliente |
| `MSJPUESTO` | `PSTMSJMOVIL` | Mensajes dirigidos a un móvil |
| `POSSESSI` | `POSSESSMOV` | Sesión POS asociada a un móvil |
| `CELSLOGS` | `CELLOGMOVI` | Logs de celular/GPS con id de móvil |

---

## 1. `MOVILES` — Maestro de móviles (vehículos de reparto)

- **count(*) = 100**  (PK aparente: `MOVID`, sin duplicados)
- Distribución por estado (`MOVESTCOD`): 1=ACTIVO → 18, 2=INACTIVO → 37, 3=NO TRABAJA MAS → 45.
- 13 puestos distintos (`MOVPUESTOID`), 70 fleteras distintas referenciadas (`MOVEFLID`).

| Columna | Tipo | Inferencia |
|---|---|---|
| `MOVID` | DEC(6,0) | **PK** id del móvil |
| `MOVPUESTOID` | DEC(6,0) | **FK → puesto** |
| `MOVDSC` | CHAR(20) | Descripción / nombre corto (a veces nombre del chofer) |
| `MOVEFLID` | DEC(6,0) | **FK → `EFLETERA.EFLID`** (empresa fletera) |
| `MOVMARCA` | CHAR(30) | Marca del vehículo |
| `MOVMODELO` | CHAR(30) | Modelo |
| `MOVMAT` | CHAR(10) | Matrícula (patente) |
| `MOVOBS` | CHAR(60) | Observaciones |
| `MOVESTCOD` | DEC(2,0) | **FK → `MOVESTADO.MOVESTCOD`** (estado) |
| `MOVBOD13TOPE` | DEC(3,0) | Tope de bodega de garrafas de 13kg |
| `MOVTELFNRO` | CHAR(30) | Teléfono del móvil |
| `MOVGPSMOVID` | DEC(6,0) | Id GPS del móvil (referencia a sistema GPS externo) |
| `MOVCELACT` | CHAR(1) | Celular activo (S/N) |
| `MOVPEDLOTE` | DEC(4,0) | Lote de pedidos |
| `MOVULTMODIFICACION` | TIMESTAMP | Última modificación |
| `MOVSERVPRINCIPAL` | CHAR(30) | Servicio principal (texto libre: "REPARTO", "REPARTO URGENTE", "URGENTE - COMERCIO", "MERCEDES"…) — NO FK a `SERVICIO` |
| `MOVULTCOORDX` / `MOVULTCOORDY` | DEC(13,5) | Última coordenada (lon/lat) |
| `MOVTIEMPOCUMPLSERVICIO` | DEC(4,0) | Tiempo de cumplimiento de servicio |
| `MOVNROMOVIL` | DEC(10,0) | Nº de móvil (suele coincidir con `MOVID`) |
| `MOVDESCRIPCION` | CHAR(30) | Descripción larga ("FABIAN SILVA (4)") |
| `MOVFIREBASEENVIADO` | TIMESTAMP | Sync a Firebase (app móvil) — enviado |
| `MOVFIREBASEELIMINADO` | TIMESTAMP | Sync a Firebase — eliminado |
| `MOVAPPPUEDEDESACTIVAR` | CHAR(1) | La app puede desactivar (S/N) |
| `MOVPERMITEBAJAMOMENTANEA` | CHAR(1) | Permite baja momentánea (S/N) |
| `MOVDISTANCIAMAXMTSCUMPPEDIDOS` | DEC(6,0) | Distancia máx (m) para cumplir pedidos (default 999999) |

**Muestra:**
```
(4, 2, 'FABIAN SILVA', 103, 'VOLKSWAGEN','DELIVERY','STP 6576', est=1, bod13=90, tel='098048521', celact='S', ...firebase..., distmax=999999)
(5, 2, '3147', 1, 'CHEVROLET','NKR','STP 3147', est=3, bod13=60, gpsmovid=15, ...)
```

PK: `MOVID`. FKs: `MOVEFLID→EFLETERA.EFLID`, `MOVPUESTOID→puesto`, `MOVESTCOD→MOVESTADO`.

---

## 2. `EFLETERA` — Maestro de empresas fleteras

- **count(*) = 90**  (PK aparente: `EFLID`, sin duplicados)
- 13 puestos distintos (`EFLPUESTOID`). Estado: `A`(activo)=46, `P`(pendiente?)=44.

| Columna | Tipo | Inferencia |
|---|---|---|
| `EFLID` | DEC(6,0) | **PK** id empresa fletera |
| `EFLPUESTOID` | DEC(6,0) | **FK → puesto** |
| `EFLNOM` | CHAR(30) | Nombre (fantasía) |
| `EFLRAZONSOCIAL` | CHAR(80) | Razón social |
| `EFLDIRECCION` | CHAR(80) | Dirección |
| `EFLTEL` | CHAR(60) | Teléfono |
| `EFLMAIL` | CHAR(60) | Email |
| `EFLRUC` | DEC(12,0) | RUC |
| `EFLESTADO` | CHAR(1) | Estado (`A`/`P`) |
| `EFLOBS` | CHAR(60) | Observaciones |
| `EFLGPSEFLETERA` | DEC(3,0) | Id/flag GPS de la fletera (49, 50…) |

**Muestra:** `(342,4,'STP 6593','RIOGAS SA','19 DE ABRIL 1500','4733 1710','SALTO@RIOGAS.COM.UY', est='A', gps=50)`

PK: `EFLID`. FK: `EFLPUESTOID→puesto`.

---

## 3. `MOVESTADO` — Catálogo de estados de móvil

- **count(*) = 4**. PK: `MOVESTCOD`.

| Columna | Tipo | |
|---|---|---|
| `MOVESTCOD` | DEC(2,0) | **PK** código |
| `MOVESTNOM` | CHAR(30) | Nombre |
| `MOVESTACT` | CHAR(1) | Flag/letra de actividad |

Valores: `1 ACTIVO (A)`, `2 INACTIVO (I)`, `3 NO TRABAJA MAS (NULL)`, `4 NO RECIBE PEDIDOS (N)`.

---

## 4. `MOVBODEGALEVEL1` — Stock / bodega por móvil

- **count(*) = 0**  (subtabla GeneXus level-1; hoy vacía). Única tabla `%BODEGA%` del esquema.

| Columna | Tipo | Inferencia |
|---|---|---|
| `MOVID` | DEC(6,0) | **FK → `MOVILES.MOVID`** (parte de PK compuesta) |
| `MOVPRODID` | CHAR(15) | **FK → producto** (id) |
| `MOVPRODPUESTOID` | DEC(6,0) | Puesto del producto |
| `MOVBODEGA` | DEC(3,0) | Cantidad en bodega |
| `MOVBODSINACT` | DEC(3,0) | Cantidad sin activar |
| `MOVBODFCH` | TIMESTAMP | Fecha |

PK aparente compuesta: (`MOVID`, `MOVPRODID`, `MOVPRODPUESTOID`).

---

## 5. `CHOFERES` + `CHOFERE1` — Choferes y su asignación a móviles

### 5.1 `CHOFERES` — Maestro de choferes (count = 63, PK `CHFID`)

| Columna | Tipo | Inferencia |
|---|---|---|
| `CHFID` | DEC(6,0) | **PK** |
| `CHFFCHALTA` | TIMESTAMP | Fecha alta |
| `CHFNOM` | CHAR(80) | Nombre |
| `CHFCI` | CHAR(10) | Cédula |
| `CHFESTADO` | CHAR(1) | Estado (A…) |
| `CHFEFLID` | DEC(6,0) | **FK → `EFLETERA.EFLID`** (fletera empleadora) |
| `CHFOBS` | CHAR(160) | Observaciones |
| `CHFFCHNAC` | CHAR(8) | Fecha nac (YYYYMMDD) |
| `CHFSOCIEDADMEDICA` | CHAR(40) | Sociedad médica |
| `CHFLOGIN` / `CHFPASS` / `CHFPASSM` | CHAR | Credenciales app |
| `CHFPUESTOID` | DEC(6,0) | **FK → puesto** |

### 5.2 `CHOFERE1` — Asignación chofer ↔ móvil (count = 71)

| Columna | Tipo | Inferencia |
|---|---|---|
| `CHFID` | DEC(6,0) | **FK → `CHOFERES.CHFID`** |
| `MOVID` | DEC(6,0) | **FK → `MOVILES.MOVID`** |
| `CHFMOVFCHALTA` | TIMESTAMP | Fecha de asignación |
| `MOVDEF` | DEC(1,0) | Flag móvil por defecto del chofer (1) |

Es la relación **N:M chofer↔móvil**. (`CHOFERE2` es variante/índice GeneXus, no inspeccionada en detalle.)

---

## 6. `FLETES` — Tarifario de flete por ZONA (¡no es del móvil!)

- **count(*) = 783**. A pesar del nombre, **NO referencia móvil ni fletera**: es la **tarifa de flete por zona / servicio / producto / tipo de cliente**.

| Columna | Tipo | Inferencia |
|---|---|---|
| `ZONID` | DEC(6,0) | **FK → zona** (parte de PK) |
| `ZONFLVIG` | CHAR(8) | Fecha de vigencia (YYYYMMDD) |
| `ZONSERVID` | DEC(6,0) | **FK → `SERVICIO`** |
| `ZONPRDPUESTOID` | DEC(6,0) | Puesto del producto |
| `ZONPRDID` | CHAR(15) | **FK → producto** |
| `ZONATPOCLIID` | DEC(6,0) | **FK → tipo de cliente** |
| `ZONFLVALOR` | DEC(9,2) | Valor del flete |
| `ZONFLESTADO` | CHAR(1) | Estado (`P`…) |

**Muestra:** `(4,'20090617',0,2,'SUPERGAS 13 K.',0, 71.00,'P')`

PK aparente compuesta: (`ZONID`,`ZONFLVIG`,`ZONSERVID`,`ZONPRDPUESTOID`,`ZONPRDID`,`ZONATPOCLIID`).

---

## 7. `GXA0034` — Auditoría GeneXus de `MOVILES`

- **count(*) = 82**. Mismas primeras 19 columnas que `MOVILES` (sin los campos nuevos: Firebase, flags app, distancia máx, nroMóvil, descripción). Es el **snapshot/auditoría histórica** generado por GeneXus para la transacción `MOVILES`. Ej: el móvil 4 figura con marca `FOTON 2500` (valor viejo) vs `VOLKSWAGEN DELIVERY` actual en `MOVILES`.
- **Para el merge: usar `MOVILES` como fuente de verdad; `GXA0034` solo si se quiere historia de cambios.**

---

## 8. Tablas que referencian móvil/fletera (config y operación)

| Tabla | Columna | Tipo | Inferencia |
|---|---|---|---|
| `PEDIDOS` | `PEDMOVIL` | DEC(6,0) | Móvil que entrega el pedido (FK→MOVILES) |
| `PEDIDOS` | `PEDMOVEFLID` | DEC(3,0) | Fletera del pedido |
| `PEDIDOS` | `PEDIMPORTEFLETE` | DEC(11,2) | Importe de flete cobrado |
| `PUESTOS` | `PUESTOGPSEFLETERA` | DEC(3,0) | GPS fletera default del puesto |
| `PUESTOS` | `PUESTOFLETECOBRA` / `PUESTOFLETECANTIDAD` | CHAR(2) | Config flete a nivel puesto |
| `ZONA` | `ZONFLETECOBRA` / `ZONFLETECANTIDAD` | CHAR(2) | Config flete a nivel zona |
| `CLIENTE` | `CLIFLETECOBRA` / `CLIFLETECANTIDAD` | CHAR(2) | Config flete a nivel cliente |
| `MSJPUESTO` | `PSTMSJMOVIL` | DEC(6,0) | Mensaje al móvil |
| `POSSESSI` | `POSSESSMOV` | CHAR(6) | Sesión POS del móvil |
| `CELSLOGS` | `CELLOGMOVI` | DEC(6,0) | Log GPS/celular con id de móvil |

> `CELSINFO` (count 120.881) y `CELSINFONUEVA` son telemetría de dispositivos celulares/GPS (`CELINFCOMM`,`CELINFPARM`,`CELINFID`,`CELNUM`) — **no tienen columna `MOV`**; el vínculo con móvil es indirecto vía `MOVGPSMOVID` / `CELSLOGS.CELLOGMOVI`. Para el merge probablemente fuera de alcance (volumen alto, telemetría).

---

## 9. Jerarquía (diagrama textual)

```
PUESTO (id genérico de sucursal interior)
  │  ├─< EFLETERA            (EFLETERA.EFLPUESTOID  → PUESTO)            [90 fleteras, 13 puestos]
  │  │       │
  │  │       ├─< MOVILES     (MOVILES.MOVEFLID      → EFLETERA.EFLID)   [100 móviles, 70 fleteras usadas]
  │  │       │      │  (MOVILES.MOVPUESTOID → PUESTO, redundante con la fletera)
  │  │       │      │  (MOVILES.MOVESTCOD   → MOVESTADO.MOVESTCOD)
  │  │       │      │
  │  │       │      ├─< MOVBODEGALEVEL1   (MOVID → MOVILES.MOVID)        [stock por móvil, vacío]
  │  │       │      └─< CHOFERE1          (MOVID → MOVILES.MOVID,        [N:M chofer↔móvil, 71]
  │  │       │                              CHFID → CHOFERES.CHFID)
  │  │       │
  │  │       └─< CHOFERES    (CHOFERES.CHFEFLID → EFLETERA.EFLID,        [63 choferes]
  │  │                         CHOFERES.CHFPUESTOID → PUESTO)
  │  │
  │  └─< (config flete a nivel PUESTO: PUESTOFLETECOBRA/CANTIDAD, PUESTOGPSEFLETERA)
  │
  ├─< ZONA   (config flete: ZONFLETECOBRA/CANTIDAD)  ──< FLETES (tarifa flete por zona/serv/prod/tipoCli) [783]
  └─< CLIENTE (config flete: CLIFLETECOBRA/CANTIDAD)

PEDIDOS  → PEDMOVIL (móvil que entrega), PEDMOVEFLID (fletera), PEDIMPORTEFLETE (flete cobrado)
```

**Columnas de join clave:**
- móvil → fletera: `MOVILES.MOVEFLID = EFLETERA.EFLID`
- móvil → puesto: `MOVILES.MOVPUESTOID = PUESTO`  (y `EFLETERA.EFLPUESTOID = PUESTO`)
- móvil → estado: `MOVILES.MOVESTCOD = MOVESTADO.MOVESTCOD`
- chofer → fletera: `CHOFERES.CHFEFLID = EFLETERA.EFLID`
- chofer ↔ móvil: `CHOFERE1.CHFID = CHOFERES.CHFID` y `CHOFERE1.MOVID = MOVILES.MOVID`
- pedido → móvil: `PEDIDOS.PEDMOVIL = MOVILES.MOVID`

---

## 10. Integridad y ambigüedades detectadas (para el diseño del merge)

1. **`MOVEFLID` huérfano:** 1 móvil tiene `MOVEFLID` que NO existe en `EFLETERA` (FK no enforced en AS400). Hay que decidir tratamiento (nulificar / crear fletera placeholder).
2. **PK escalares globales:** `MOVID` y `EFLID` son únicos sin necesidad del puesto (NO son PK compuestas con `MOVPUESTOID`/`EFLPUESTOID`). El puesto es atributo, no parte de la clave. → en Postgres, PK natural `mov_id` / `efl_id` está OK.
3. **Redundancia puesto:** un móvil trae `MOVPUESTOID` propio Y pertenece a una fletera que tiene su `EFLPUESTOID`. Verificar si siempre coinciden o si puede haber móvil de un puesto operando bajo fletera de otro.
4. **`FLETES` mal nombrado:** es tarifario por **zona**, no flota. No mezclar con el ecosistema de móviles salvo que el merge quiera también precios de flete.
5. **`MOVSERVPRINCIPAL` es texto libre** (no FK a `SERVICIO`). Si se quiere normalizar, hay que mapear strings ("REPARTO URGENTE", etc.) a `SERVICIO`.
6. **GPS/telemetría:** `MOVGPSMOVID`, `EFLGPSEFLETERA`, `CELSINFO`/`CELSLOGS` apuntan a un subsistema GPS externo. `CELSINFO` tiene 120k filas. Definir si entra al merge o queda fuera.
7. **`MOVBODEGALEVEL1` vacía hoy** — el stock por móvil puede vivir en otra tabla/proceso; confirmar antes de modelarla.
8. **Estados:** `MOVESTADO` tiene 4 estados pero solo se observan 1/2/3 en datos (estado 4 "NO RECIBE PEDIDOS" sin uso actual). `EFLESTADO` usa `A`/`P` sin catálogo asociado (interpretación de `P` a confirmar: ¿pendiente? ¿persona física?).
9. **`GXA0034`** es auditoría GeneXus, no maestro. Excluir del merge de datos vivos.
10. **`COLUMN_TEXT` vacío en todo el catálogo** → no hay descripciones oficiales; los nombres de columna son la única documentación. Conviene validar las inferencias con un usuario funcional antes del merge.
