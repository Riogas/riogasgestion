# Inventario de "Móviles" y "Empresas Fleteras" — esquema AS400/DB2 `GXCALDTA` (Capital/Montevideo)

**Fecha:** 2026-06-24
**Tipo:** Discovery solo-lectura para diseñar merge a Postgres. No se modificó nada en AS400.
**Conexión:** jaydebeapi + AS400JDBCDriver, `from _creds import as400`, esquema `GXCALDTA`.

> **CAVEAT IMPORTANTE sobre descripciones GeneXus:** se intentó leer `TABLE_TEXT`/`COLUMN_TEXT`/`COLUMN_HEADING`/`LONG_COMMENT` de `QSYS2.SYSTABLES` y `QSYS2.SYSCOLUMNS`. En este esquema **esas descripciones NO están pobladas en el catálogo DB2** (vienen `NULL`, y `COLUMN_HEADING` repite el nombre de la columna). La única `TABLE_TEXT` no vacía fue `FLETE0001` = *"Nombre anterior FLETE en GXCALDTA propiedad de AS4..."*. Por lo tanto los significados de columnas de abajo están **inferidos** de nombre + datos de muestra, no de la metadata GeneXus (que vive en la KB de GeneXus, no en DB2).

---

## 1. Lista completa confirmada (31 objetos con MOV/FLET en el nombre)

| Objeto | Tipo | Aud? | Vista? | Rol |
|---|---|---|---|---|
| **MOVILES** | T (base) | | | **Maestro de móviles (vehículos de reparto).** PK `MOVID`. FK `EFLID`→fletera. count **416** |
| AMOVILES | T | **A=auditoría de MOVILES** | | Misma estructura que MOVILES (sin `MOVEXTDT1/2`). No detallada. |
| **MOVZONAS** | T | | | Zonas que cubre cada móvil. PK compuesta. count **537** |
| AMOVZONA | T | **A=auditoría de MOVZONAS** | | count 413 |
| **MOVHORAR** | T | | | Cabezal de horario del móvil (vigencias). count **57** |
| **MOVHORA1** | T | | | Detalle horario por día de semana. count **372** |
| **MOVHORA2** | T | | | Excepciones de horario. count **2** |
| **MOVSERV** | T | | | Servicios/tipos que presta cada móvil (M:N). count **1511** |
| **MOVBODEG** | T | | | Bodega (capacidad asignada por producto). count **329** |
| **MOVSTOCK** | T | | | Stock actual de garrafas por móvil/producto. count **308** |
| **MOVCANTX** | T | | | Cantidades/objetivos por escenario-zona-servicio. count **218** |
| **MOVESTAD** | T | | | Catálogo de estados del móvil. count **8** |
| **MOVDESTI** | T | | | Destinos/puntos de reubicación del móvil. count **256** |
| **MOVHISTE** | T | | | **Histórico de eventos/estados del móvil. count 3.215.499** |
| **MOVICAMO** | T | | | Relación móvil ↔ distribuidor ICA (`DISTID`). count **304** |
| AMOVICAM | T | **A=auditoría de MOVICAMO** | | count 85 |
| **MOVASOCR** | T | | | Log de reubicaciones/asociaciones (fecha ini/fin + operador). count **428.781** |
| **CLIMOVIL** | T | | | Clientes con móvil preferido/asignado + prioridad. count **507** |
| **EFLETERA** | T | | | **Maestro de empresas fleteras (= puesto/sucursal contratista).** PK `EFLID`. count **132** |
| **EFLETER1** | T | | | Usuarios (logins de puesto) por fletera (M:N). count **45** |
| **EFLETER2** | T | | | DNIs/cédulas por fletera. count **1** |
| **FLETE** | T | | | **Tarifa de flete vigente** (servicio/producto/zona/tipo-cliente). *Dominio "flete=costo de entrega", NO vehículo.* count **117** |
| FLETELEV | T | | | Histórico de tarifas de flete (con fecha vig + monto). count 643 |
| FLETE0001 | T | | | *"Nombre anterior FLETE"* — variante/legacy de FLETE. count 11 |
| APPMOVI2 | T | | | App "Móvil" web/WhatsApp: pedidos/llamadas tomadas. count 12.925 |
| APPMOVI3 | T | | | Canales de la app (APPMOVIL/WHATSAPP/MESSENGER) + vigencia. count 3 |
| APPMOVI4 | T | | | Horarios de atención por canal/día de la app. count 21 |
| APPMOVI5 | T | | | Excepciones (feriados) de la app. count 95 |
| APPMOVMS | T | | | Log de mensajes/estados de la app móvil. count 7 |
| **V_MOVACT** | **V (vista)** | | **V** | Móviles activos "lindos" (denormalizado, con nombre de fletera). count **101** |
| **V_MOVXZON** | **V (vista)** | | **V** | Cantidad de móviles por zona. count **109** |

Auditoría (prefijo `A`): **AMOVILES, AMOVZONA, AMOVICAM**. Vistas (`V_`): **V_MOVACT, V_MOVXZON** (+ V_MSERXZON, V_MURGXZON, V_PEDPEND, V_RUTAS, V_SERVICES referencian móviles pero no llevan MOV/FLET literal en nombre de objeto — ver §2).

---

## 2. Tablas que REFERENCIAN móviles por columna (sin MOV/FLET en el nombre)

`SELECT DISTINCT TABLE_NAME,COLUMN_NAME FROM QSYS2.SYSCOLUMNS WHERE TABLE_SCHEMA='GXCALDTA' AND (COLUMN_NAME LIKE '%MOV%' OR COLUMN_NAME LIKE '%FLET%')` → 216 columnas. Las relevantes **fuera** de las tablas MOV*/FLET*/EFL*:

| Tabla | Columna(s) | Interpretación |
|---|---|---|
| **PEDIDOS** | `PEDMOVIL`, `PEDMOVEFLI` | Pedido → móvil asignado (y fletera del móvil). **Join principal pedido↔móvil.** |
| PEDID | `PEDMOVIL` | (variante/legacy de PEDIDOS) |
| PEDDESAC | `PEDDESMOVI` | Pedidos desactivados → móvil |
| PEDESTA2 / PEDESTA3 | `PDSTDMOV`, `PDSTDMOVHO` | Estadísticas de pedidos por móvil |
| PEDLOG | `PEDLOGMOVI` | Log de pedidos → móvil |
| **SERVICES** | `SERVTMOVIL`, `SERVTMOVEF` | Servicio/orden → móvil (+ fletera). |
| **CHOFERE1** | `MOVID`, `MOVDEF`, `CHFMOVFCHA` | **Choferes ↔ móvil** (asignación chofer-vehículo). |
| **GPSS** | `GPSMOVID`, `GPSMOVMA` | Posiciones GPS por móvil. |
| **CELULARE / CELSLOGS** | `CELMOVID`, `CELLOGMOVI` | Celular/dispositivo ↔ móvil. |
| **RADIOS** | `RADMOVID` | Radio ↔ móvil. |
| DISTRIBU | `DISTMOVILI`, `DISTMOVPIS`, `DISTAPPMOV` | Distribución/ruteo ICA → móvil. |
| CREDITOS | `CREDMOVIL` | Crédito asociado a móvil. |
| INCIDENT | `INCMOVIL` | Incidentes por móvil. |
| RUTMANUA | `RUTMOVID` | Ruteo manual → móvil. |
| ICAOBELI / ICAOBEL1 / ICAMAPAP | `RUTSINIMOV`,`RUTMOVILES`,`RUTMOVMAXP`,`RUTMOVNIV`,`RUTMOVSTK`,`IMPEDMOVIL` | Ruteador "Obelix"/ICA: niveles, stock, máx pedidos por móvil. |
| CLIENTE | `SADASIMOVM` | Cliente → móvil "SAD" asignado. |
| PLAZOSE | `PLZEMOVACT`,`PLZEMOVAST`,`PLZEMOVLOT` | Plazos de entrega ligados a estado/lote del móvil. |
| SADEVENT / SADLOGS | `SADMOVIL`,`SADLOGMOVI` | Eventos SAD por móvil. |
| POSSESSI | `POSSESSMOV` | Posesión/asignación física de móvil. |
| SMSBACK | `SMSMOV` | SMS por móvil. |
| GCIVTASOLD | `VTASFLETE` | Ventas: monto de flete cobrado. |
| ZONINFOD | `ZONINFMOVA` | Info de zona: móvil activo. |
| V_MSERXZON / V_MURGXZON / V_MOVXZON / XABORRAR | `CANT_MOVILES` | Vistas de conteo de móviles por zona. |
| V_PEDPEND / V_RUTAS / V_SERVICES | `MOVIL_ASIGNADO`, `ASIGNACION_MOVIL_XRUTEO` | Vistas de ruteo: móvil asignado a pedido. |

---

## 3. Jerarquía PUESTO → EMPRESA FLETERA → MÓVIL

```
PUESTO / SUCURSAL (no hay tabla dedicada)
   │   El "puesto" se materializa como el/los usuarios GeneXus (logins) del contratista.
   │   join: EFLETERA.EFLUSER  (1 user "cabeza") ─┐
   │         EFLETER1.EFLUSUARIO (N users por EFLID, M:N) ─┘  valores tipo 'PUESTOMA','PSTCENTRO','LPPISTAM'...
   ▼
EMPRESA FLETERA  =  EFLETERA   (PK EFLID DECIMAL(3), 132 filas, EFLESTADO A=59 / P=73)
   │   EFLNOM='RIOGAS PLANTA','MONDELLI SRL','TORCOR'...  EFLRUC, EFLTEL, EFLMAIL
   │   dirección propia: EFLCALID (id de calle) + EFLNROPUER (nro puerta) + EFLBIS/EFLAPTO
   │   EFLMOVPUES casi siempre 0 (solo 2 filas ≠0) → NO es el join real a móvil
   │
   │   join móvil↔fletera:  MOVILES.EFLID  ──►  EFLETERA.EFLID
   │   (integridad LIMPIA: 0 móviles con EFLID huérfano; 87 EFLID distintos usados por 416 móviles)
   ▼
MÓVIL (vehículo)  =  MOVILES   (PK MOVID DECIMAL(6), 416 filas)
       MOVMARCA/MOVMODELO/MOVMAT(matrícula)/MOVTPOSERI(URG,SERVI,AUTOM=tipo servicio)
       MOVESTCOD ──► MOVESTAD.MOVESTCOD (estado)
       MOVDESTID ──► MOVDESTI.MOVDESTID (destino/reubicación)
       MOVCALID+MOVCALNROP (ubicación calle/puerta) ; MOVX/MOVY, MOVACTENX/Y (coords UTM)
       MOVGPS/MOVGPSOK (tiene/reporta GPS) ; MOVPEDPEND (pedidos pendientes) ; MOVRUTEA
```

**Diferencia EFLETERA vs EFLETER1 vs EFLETER2** (las tres comparten PK `EFLID DECIMAL(3)`):
- `EFLETERA` (132) = **maestro 1 fila por fletera**: nombre, RUC, tel, mail, dirección, estado, observaciones.
- `EFLETER1` (45 filas / **22 EFLID distintos** → relación 1:N) = **usuarios (logins de puesto) habilitados por fletera** + mails. Ej. EFLID 11 → MARPISTAM, MARPISTAT, NCABRAL, PUESTOMA2, WCHAVEZ. Es la tabla que materializa "qué puestos/operadores pertenecen a la fletera".
- `EFLETER2` (**1 fila**) = DNIs/cédulas por fletera (`EFLDNIS`,`EFLDNISPRI`). Prácticamente vacía/marginal.

**Nota merge:** no existe entidad "PUESTO" formal en GXCALDTA; el puesto = la fletera (contratista por sucursal) + sus usuarios. Si en interior (PUESTOS lib) hay un concepto de puesto físico, el merge deberá mapear EFLETERA↔puesto.

---

## 4. Detalle por tabla (las base + vistas; auditoría A* omitidas salvo nota)

### MOVILES — maestro de vehículos (PK `MOVID`, 416)
Cols clave: `MOVID`(PK), `EFLID`(FK fletera), `MOVMARCA`,`MOVMODELO`,`MOVMAT`(matrícula),`MOVTPOSERI`(URG/SERVI/AUTOM),`MOVESTCOD`(FK estado),`MOVACTDESD`/`MOVACTHAST`(alta/baja AAAAMMDD),`MOVPEDPEND`(pedidos pendientes),`MOVTELFNRO`,`MOVRUTEA`(S/N entra al ruteo),`MOVT1`/`MOVT2`(tamaño/capacidad lote),`MOVX`/`MOVY`+`MOVACTENX`/`MOVACTENY`(coords UTM),`MOVPOSFCHA`(fecha última posición),`MOVGPS`/`MOVGPSOK`,`MOVCALID`/`MOVCALNROP`(calle/puerta),`MOVDESTID`(FK destino). Hay 7 `MOVAUXINT*`, 5 `MOVAUXSTR*`, 3 `MOVAUXDT*` (campos auxiliares GeneXus genéricos, revisar uso real antes de migrar). `AMOVILES` = auditoría idéntica (sin MOVEXTDT1/2).

### EFLETERA — empresas fleteras (PK `EFLID`, 132)
`EFLID`(PK),`EFLNOM`,`EFLTEL`,`EFLMAIL`,`EFLRUC`,`EFLCALID`+`EFLNROPUER`+`EFLBIS`+`EFLAPTO`(dirección),`EFLESTADO`(A/P),`EFLOBS`,`EFLUSER`(login cabeza del puesto),`EFLNOMCOMO`(nombre comercial),`EFLRERUTEA`,`EFLSOLSTCK`,`EFLULTINGS`,`EFLMOVPUES`(≈0),`EFLINCIDEN`.

### EFLETER1 / EFLETER2 — ver §3.

### FLETE / FLETELEV / FLETE0001 — **tarifas de flete (dominio costo, NO vehículo)**
PK aparente (`FLSERID`,`FLEMPCOD`,`FLPROCOD`,`FLTPOCLIID`,`FLZONID`). `FLETE`(monto), `FLDIASEMAN`,`FLHORARIO`(Diurno),`FLPRODPRIN`,`FLXPROD`. `FLETELEV` agrega `FLFCHVIG`+`FLETE`(histórico de tarifa). `FLETE0001` = legacy de FLETE. **Sub-dominio aparte**: cuánto se cobra de flete por servicio/producto/zona/tipo de cliente. Relevante para costeo, no para la entidad vehículo.

### MOVZONAS / AMOVZONA — zonas que cubre el móvil (537 / 413 aud)
`MOVID`(FK),`ESCID`(escenario),`ESCCANALID`,`ESCZONAID`(FK zona),`ESCZONTPO`(tipo, 1=primaria/2=secundaria aparente),`ESCZONFLAG`. M:N móvil↔zona. `V_MOVXZON`/`V_MSERXZON`/`V_MURGXZON` = conteos de móviles por zona.

### MOVHORAR / MOVHORA1 / MOVHORA2 — horarios del móvil
- `MOVHORAR`(57): cabezal por móvil — `MOVHORFCHV`/`MOVHORFCHF`(vig desde/hasta),`MOVHORSDIA`(días/semana),`MOVHOROBS`,`MOVHORUSUA`.
- `MOVHORA1`(372): detalle por día — `DIAID`(1-7),`DIAHORDESD`/`DIAHORHAST`(franja horaria).
- `MOVHORA2`(2): excepciones puntuales (`MOVHEHORDE/HA`,`MOVHEOBS`,`MOVHEFCHAL`).

### MOVSERV — servicios que presta el móvil (M:N, 1511)
`MOVID`+`MOVSERID`. `MOVSERID` es un código pequeño (valores: 1,2,3,6,9,11,30,31,33,34,35,36,37,40,43,44,45,70,88,98). **No hay tabla catálogo dedicada** que mapee MOVSERID→nombre dentro de las MOV* (probable catálogo en otra tabla de tipos de servicio; **AMBIGÜEDAD para merge**).

### MOVBODEG — bodega / capacidad por producto (329)
`MOVID`,`MOVPRODEMP`(RI),`MOVPRODCOD`(cód producto, ej 1002013),`MOVBODEGA`(capacidad),`MOVBODSINA`,`MOVBODFCH`. Cuántas garrafas de cada producto carga el móvil.

### MOVSTOCK — stock actual del móvil (308)
`MOVID`,`MOVPRDEMPC`,`MOVPRDCOD`,`MOVPRDSTKM`(stock móvil),`MOVPRDSTKO`(stock ocupado/otro),`MOVPRDTIEC`,`MOVPRDTIED`. Garrafas a bordo en tiempo real.

### MOVCANTX — cantidades objetivo por escenario/zona/servicio (218)
`MOVCANTESC`,`MOVCANTZON`,`MOVCANTSER`,`MOVCANTCAN`(cantidad),`MOVCANTFLA`. Parametriza cuántos móviles/cantidad por combinación escenario-zona-servicio (ruteo/planificación).

### MOVESTAD — catálogo de estados (8) — **catálogo clave**
`MOVESTCOD`→`MOVESTNOM`/`MOVESTICA`:
`0`=ACTIVO EN ESPERA, `1`=ACTIVO EN VIAJE AL CLIENTE, `2`=ACTIVO EN VIAJE A RECARGA, `3`=NO ACTIVO, `4`=NO ACTIVO MOMENTÁNEAMENTE, `5`=NO DEFINIDO (PASIVO), `6`=NO SE LE RUTEAN PEDIDOS (PASIVO), `15`=NO TRABAJA MÁS (PASIVO).

### MOVDESTI — destinos/puntos de reubicación (256)
`MOVDESTID`(PK),`MOVDESTNOM`,`MOVDESTX`/`MOVDESTY`(coords UTM),`MOVDESTOBS`(dirección texto). Referenciado por `MOVILES.MOVDESTID`.

### MOVHISTE — histórico de eventos del móvil (**3.215.499**)
`MOVID`,`MOVHISEFCH`(fecha),`MOVHISEST`(estado/acción: REUBICA, SE DESACTIVA...),`MOVHISTUSE`(usuario/sistema: OBELIX, RADIOA538),`MOVHISTDSC`(detalle),`MOVHISCHFI`. **Tabla más grande del dominio; alto volumen → decidir si migrar histórico completo o resumido.**

### MOVICAMO / AMOVICAM — móvil ↔ distribuidor ICA (304 / 85 aud)
`MOVID`+`DISTID`(FK a DISTRIBU). Qué distribuidor ICA opera cada móvil.

### MOVASOCR — log de reubicaciones/asociaciones (**428.781**)
`MOVRESFCHI`/`MOVRESFCHF`(ini/fin),`MOVRESOPER`(operador). **No tiene MOVID propio** en las 3 columnas listadas → ojo, parece tabla de log con PK temporal; verificar si falta columna móvil o si se asocia por timestamp (**AMBIGÜEDAD para merge**).

### CLIMOVIL — cliente ↔ móvil preferido (507)
`CLIID`(FK cliente, 0=genérico),`CLIMOVID`(FK móvil),`CLIMOVPRIO`(prioridad 1/2/3). Móvil(es) preferido(s) por cliente.

### APPMOVI2/3/4/5 + APPMOVMS — canal "App Móvil" (pedidos web/WhatsApp/Messenger)
- `APPMOVI2`(12.925): pedidos/llamadas tomadas por la app (`APPMID`,`APPMTEL`,`APPMOBSLLA`,`APPMUSULLA`,`APPMFCHLLA`,`APPMESTADO`,`APPMPEDID`→pedido generado).
- `APPMOVI3`(3): canales (APPMOVIL/WHATSAPP/MESSENGER) + vigencia + flag "se llama".
- `APPMOVI4`(21): horarios de atención por canal/día + mensaje fuera de horario.
- `APPMOVI5`(95): excepciones (feriados) con mensaje.
- `APPMOVMS`(7): log de cambios de mensaje/estado del canal.
> **Ojo semántico:** "APPMOVI*" aquí significa **App de pedidos (canal "Móvil"/WhatsApp)**, NO vehículos. Sub-dominio distinto del resto; en el merge separar de los móviles-vehículo.

### V_MOVACT (vista, 101) — móviles activos denormalizados
Columnas legibles (la vista YA trae nombres "lindos"): `NRO`(=MOVID),`PED_PENDIENTES`,`TAMLOTE`,`TELEFONO`,`SERVICIOPRINCIPAL`,`TIENEGPS`,`GPS_REPORTANDO`,`MATRICULA`,`RECIBEENCEL`,`ESTADO`(texto),`CAPACIDADLOTE`,`OBSERVACIONES`,`USAICA`,`X`,`Y`,`EFLETERA`(nombre fletera),`MAPTIPFROM`. **Excelente fuente de referencia para nombrar columnas en Postgres.**

### V_MOVXZON (vista, 109) — `ZONA` + `CANT_MOVILES`. Conteo de móviles por zona.

---

## 5. Agrupación por sub-dominio (para el merge)

| Sub-dominio | Tablas |
|---|---|
| **Maestro vehículo** | MOVILES (+ AMOVILES aud), V_MOVACT |
| **Empresa fletera / puesto** | EFLETERA, EFLETER1, EFLETER2 |
| **Estados (catálogo)** | MOVESTAD |
| **Zonas del móvil** | MOVZONAS (+ AMOVZONA aud), V_MOVXZON, V_MSERXZON, V_MURGXZON |
| **Horarios** | MOVHORAR, MOVHORA1, MOVHORA2 |
| **Servicios** | MOVSERV |
| **Bodega / stock** | MOVBODEG, MOVSTOCK, MOVCANTX |
| **Destinos / posición** | MOVDESTI (+ MOVX/Y en MOVILES) |
| **Histórico / logs** | MOVHISTE, MOVASOCR |
| **ICA / distribución** | MOVICAMO (+ AMOVICAM aud) |
| **Relación con cliente** | CLIMOVIL |
| **Canal App de pedidos (NO vehículo)** | APPMOVI2, APPMOVI3, APPMOVI4, APPMOVI5, APPMOVMS |
| **Tarifa de flete (costo, NO vehículo)** | FLETE, FLETELEV, FLETE0001 |
| **Referencian móvil desde otros dominios** | PEDIDOS/PEDID/PEDDESAC/PEDESTA2/3/PEDLOG, SERVICES, CHOFERE1, GPSS, CELULARE/CELSLOGS, RADIOS, DISTRIBU, CREDITOS, INCIDENT, RUTMANUA, ICAOBELI/ICAOBEL1/ICAMAPAP, CLIENTE.SADASIMOVM, PLAZOSE, SADEVENT/SADLOGS, POSSESSI, SMSBACK, ZONINFOD, V_PEDPEND/V_RUTAS/V_SERVICES |

---

## 6. Ambigüedades / preguntas abiertas para el merge

1. **Descripciones GeneXus ausentes en DB2** → para semántica fina hay que sacar el dictionary de la KB GeneXus o validar con negocio. Nada de COLUMN_TEXT disponible vía SQL.
2. **`MOVSERV.MOVSERID` sin catálogo dentro de MOV*** → falta tabla de tipos de servicio (¿en otra librería?). Mapear códigos 1..98 a nombres antes de migrar.
3. **`MOVASOCR` sin columna móvil explícita** (solo FCHI/OPER/FCHF) → confirmar cómo se liga al móvil (¿columna omitida en la consulta, PK temporal, o tabla de auditoría genérica?).
4. **`EFLETERA.EFLMOVPUES`** ≈ siempre 0 → NO usar como join fletera↔móvil; el join real es `MOVILES.EFLID`.
5. **Concepto "PUESTO"** no es tabla: es EFLETERA + usuarios EFLETER1. Definir cómo se mapea contra el modelo de puestos del interior (lib PUESTOS) en el modelo unificado.
6. **APPMOVI\*** son canal de pedidos, NO vehículos → separar para no contaminar la entidad "móvil".
7. **FLETE\*** son tarifas de costo de entrega → sub-dominio financiero, separar de vehículos (homónimo "flete").
8. **Volumen**: `MOVHISTE` (3,2M) y `MOVASOCR` (429k) → decidir estrategia (migrar histórico completo, ventana, o solo agregados).
9. Múltiples campos `MOVAUX*`/`MOVEXT*`/`APPMAUX*` genéricos GeneXus → auditar uso real columna por columna antes de portar (muchos vacíos/0).
10. Tablas legacy con sufijo numérico (`FLETE0001`, `PEDID` vs `PEDIDOS`) → confirmar cuál es la vigente.
