# Merge Móviles y Empresas Fleteras (estructura) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Crear en Postgres goya el modelo unificado de móviles/fleteras + sub-dominios (nombres amigables en español) y migrar los datos desde los 2 AS400 (PUESTOS interior + GXCALDTA capital) vía ETLs Python.

**Architecture:** Modelos Prisma nuevos (alongside los de clientes) con patrón `origen`+`idOriginal`. ETLs Python (jaydebeapi+psycopg2, reusan `backend/prisma/_creds.py`), UTM 21S→WGS84 para coords capital, idempotentes (`DELETE WHERE origen=...` antes de insertar). Sin dedup (no hay móviles duplicados entre sistemas).

**Tech Stack:** Prisma 6 / PostgreSQL (goya 192.168.2.117), Python (jaydebeapi sobre jt400, psycopg2, pyproj), AS400/DB2.

## Global Constraints

- **Nombres amigables en español** en Postgres (`latitud`/`longitud`, `nombre`, `matricula`…), NO los códigos AS400. El código AS400 va como comentario de mapeo y la trazabilidad en `idOriginal`/`origen`.
- `origen` ∈ {`interior`,`capital`}; `@@unique([origen, idOriginal])` en maestros/catálogos.
- Capital coords desde `MOVX/MOVY` (UTM 21S) → `latitud`/`longitud`; validar rango Uruguay (lat −35.5..−30, lng −59..−53) o null.
- Capital `puestoId=100` (Montevideo) + `baseOperativa=EFLUSER`; interior usa su `MOVPUESTOID`/`EFLPUESTOID`.
- Histórico (`MOVHISTE`): tabla creada, **sin** bulk. `MOVASOCR` no se modela.
- Fuera: choferes, APPMOVI*, FLETE*/FLETES, telemetría GPS, auditoría (A*/GXA0034), sync TrackMovil, front.
- ETLs en `backend/prisma/`. AS400 vía `_creds.as400()` (`os.environ.setdefault('JAVA_HOME', r'C:\Program Files\Java\jdk-21')`). Postgres vía `_creds.pg_conn_args()`.

---

### Task M1: Modelos Prisma (nombres amigables) + db push

**Files:** Modify `backend/prisma/schema.prisma` (agregar modelos al final; agregar back-relation en `ClienteUni`).

Agregar EXACTAMENTE estos modelos (nombres amigables):

```prisma
model EmpresaFletera {
  id              Int      @id @default(autoincrement())
  origen          String   @db.VarChar(10)
  idOriginal      Int                          // EFLID
  puestoId        Int?                          // interior EFLPUESTOID | capital 100
  baseOperativa   String?  @db.VarChar(20)      // capital EFLUSER (PSTCENTRO…)
  nombre          String?  @db.VarChar(80)      // EFLNOM
  nombreComercial String?  @db.VarChar(40)      // capital EFLNOMCOMO
  razonSocial     String?  @db.VarChar(80)      // interior EFLRAZONSOCIAL
  ruc             String?  @db.VarChar(12)      // EFLRUC
  direccion       String?  @db.VarChar(120)     // interior EFLDIRECCION | capital EFLCALID+EFLNROPUER
  telefono        String?  @db.VarChar(60)      // EFLTEL
  email           String?  @db.VarChar(60)      // EFLMAIL
  estado          String?  @db.VarChar(1)       // EFLESTADO A=activo / P=pasivo
  observaciones   String?  @db.VarChar(60)      // EFLOBS
  gpsId           Int?                          // interior EFLGPSEFLETERA
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  moviles         Movil[]
  @@unique([origen, idOriginal])
  @@index([puestoId])
  @@map("empresa_fletera")
}

model Movil {
  id                    Int      @id @default(autoincrement())
  origen                String   @db.VarChar(10)
  idOriginal            Int                       // MOVID
  fleteraId             Int?                       // resuelto de MOVEFLID
  puestoId              Int?                       // MOVPUESTOID | capital 100
  estadoCodigo          Int?                       // MOVESTCOD (→ movil_estado[origen,codigo])
  descripcion           String?  @db.VarChar(40)   // MOVDSC/MOVDESCRIPCION
  marca                 String?  @db.VarChar(30)
  modelo                String?  @db.VarChar(30)
  matricula             String?  @db.VarChar(10)   // MOVMAT
  telefono              String?  @db.VarChar(30)   // MOVTELFNRO
  capacidadLote         Int?                       // interior MOVBOD13TOPE | capital MOVT1
  servicioPrincipal     String?  @db.VarChar(30)   // interior MOVSERVPRINCIPAL | capital MOVTPOSERI
  tipoServicio          String?  @db.VarChar(10)   // capital MOVTPOSERI
  rutea                 Boolean?                    // capital MOVRUTEA (S/N)
  pedidosPendientes     Int?                        // MOVPEDPEND / MOVPEDLOTE
  latitud               Decimal? @db.Decimal(10, 7) // interior MOVULTCOORDX | capital MOVX (UTM→WGS84)
  longitud              Decimal? @db.Decimal(10, 7) // interior MOVULTCOORDY | capital MOVY
  ultimaPosicionAt      DateTime?                   // capital MOVPOSFCHA | interior MOVULTMODIFICACION
  gpsMovilId            Int?                        // interior MOVGPSMOVID | capital MOVGPS
  tieneGps              Boolean?
  gpsReportando         Boolean?                    // capital MOVGPSOK
  distanciaMaxMetros    Int?                        // interior MOVDISTANCIAMAXMTSCUMPPEDIDOS
  appPuedeDesactivar    Boolean?                    // interior MOVAPPPUEDEDESACTIVAR
  permiteBajaMomentanea Boolean?                    // interior MOVPERMITEBAJAMOMENTANEA
  destinoId             Int?                        // capital MOVDESTID → movil_destino
  numeroMovil           Int?                        // interior MOVNROMOVIL
  activoDesde           DateTime? @db.Date          // capital MOVACTDESD
  activoHasta           DateTime? @db.Date          // capital MOVACTHAST
  observaciones         String?  @db.VarChar(60)    // interior MOVOBS
  firebaseEnviado       DateTime?                   // interior
  firebaseEliminado     DateTime?                   // interior
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  fletera   EmpresaFletera? @relation(fields: [fleteraId], references: [id])
  destino   MovilDestino?   @relation(fields: [destinoId], references: [id])
  zonas     MovilZona[]
  servicios MovilServicio[]
  bodega    MovilBodega[]
  stock     MovilStock[]
  horarios  MovilHorario[]
  ica       MovilIca[]
  clientes  ClienteMovil[]
  historico MovilHistorico[]
  @@unique([origen, idOriginal])
  @@index([fleteraId])
  @@index([puestoId])
  @@map("movil")
}

model MovilEstado {
  id        Int     @id @default(autoincrement())
  origen    String  @db.VarChar(10)
  codigo    Int                          // MOVESTCOD
  nombre    String? @db.VarChar(30)      // MOVESTNOM
  actividad String? @db.VarChar(4)       // interior MOVESTACT | capital MOVESTICA
  @@unique([origen, codigo])
  @@map("movil_estado")
}

model Servicio {
  id              Int             @id @default(autoincrement())
  origen          String          @db.VarChar(10)
  idOriginal      Int                          // SERID
  nombre          String?         @db.VarChar(60) // SERNOM
  movilServicios  MovilServicio[]
  @@unique([origen, idOriginal])
  @@map("servicio")
}

model MovilZona {
  id          Int     @id @default(autoincrement())
  movilId     Int
  origen      String  @db.VarChar(10)
  escenarioId Int?                          // ESCID
  canalId     Int?                          // ESCCANALID
  zonaId      Int?                          // ESCZONAID (sin FK dura; id-space a confirmar)
  tipo        Int?                          // ESCZONTPO
  flag        String? @db.VarChar(2)        // ESCZONFLAG
  movil Movil @relation(fields: [movilId], references: [id], onDelete: Cascade)
  @@index([movilId])
  @@index([zonaId])
  @@map("movil_zona")
}

model MovilServicio {
  id         Int       @id @default(autoincrement())
  movilId    Int
  origen     String    @db.VarChar(10)
  servicioId Int?                          // resuelto de MOVSERID
  movil    Movil     @relation(fields: [movilId], references: [id], onDelete: Cascade)
  servicio Servicio? @relation(fields: [servicioId], references: [id])
  @@index([movilId])
  @@index([servicioId])
  @@map("movil_servicio")
}

model MovilBodega {
  id              Int       @id @default(autoincrement())
  movilId         Int
  origen          String    @db.VarChar(10)
  productoEmpresa String?   @db.VarChar(4)   // MOVPRODEMP
  productoCodigo  String?   @db.VarChar(15)  // MOVPRODCOD
  capacidad       Int?                        // MOVBODEGA
  sinActivar      Int?                        // MOVBODSINA
  fecha           DateTime?
  movil Movil @relation(fields: [movilId], references: [id], onDelete: Cascade)
  @@index([movilId])
  @@map("movil_bodega")
}

model MovilStock {
  id              Int     @id @default(autoincrement())
  movilId         Int
  origen          String  @db.VarChar(10)
  productoEmpresa String? @db.VarChar(4)    // MOVPRDEMPC
  productoCodigo  String? @db.VarChar(15)   // MOVPRDCOD
  stockMovil      Int?                       // MOVPRDSTKM
  stockOcupado    Int?                       // MOVPRDSTKO
  tiempoCarga     Int?                       // MOVPRDTIEC
  tiempoDescarga  Int?                       // MOVPRDTIED
  movil Movil @relation(fields: [movilId], references: [id], onDelete: Cascade)
  @@index([movilId])
  @@map("movil_stock")
}

model MovilCantidadObjetivo {
  id        Int     @id @default(autoincrement())
  origen    String  @db.VarChar(10)
  escenario Int?                          // MOVCANTESC
  zona      Int?                          // MOVCANTZON
  servicio  Int?                          // MOVCANTSER
  cantidad  Int?                          // MOVCANTCAN
  flag      String? @db.VarChar(2)        // MOVCANTFLA
  @@map("movil_cantidad_objetivo")
}

model MovilHorario {
  id            Int       @id @default(autoincrement())
  movilId       Int
  origen        String    @db.VarChar(10)
  vigenciaDesde DateTime? @db.Date         // MOVHORFCHV
  vigenciaHasta DateTime? @db.Date         // MOVHORFCHF
  dias          String?   @db.VarChar(20)  // MOVHORSDIA
  observaciones String?   @db.VarChar(60)  // MOVHOROBS
  usuario       String?   @db.VarChar(15)  // MOVHORUSUA
  movil       Movil                   @relation(fields: [movilId], references: [id], onDelete: Cascade)
  detalleDias MovilHorarioDia[]
  excepciones MovilHorarioExcepcion[]
  @@index([movilId])
  @@map("movil_horario")
}

model MovilHorarioDia {
  id        Int     @id @default(autoincrement())
  horarioId Int
  diaId     Int?                          // DIAID 1-7
  horaDesde String? @db.VarChar(8)        // DIAHORDESD
  horaHasta String? @db.VarChar(8)        // DIAHORHAST
  horario MovilHorario @relation(fields: [horarioId], references: [id], onDelete: Cascade)
  @@index([horarioId])
  @@map("movil_horario_dia")
}

model MovilHorarioExcepcion {
  id            Int       @id @default(autoincrement())
  horarioId     Int
  horaDesde     String?   @db.VarChar(8)  // MOVHEHORDE
  horaHasta     String?   @db.VarChar(8)  // MOVHEHORHA
  observaciones String?   @db.VarChar(60) // MOVHEOBS
  fecha         DateTime?                  // MOVHEFCHAL
  horario MovilHorario @relation(fields: [horarioId], references: [id], onDelete: Cascade)
  @@index([horarioId])
  @@map("movil_horario_excepcion")
}

model MovilDestino {
  id         Int      @id @default(autoincrement())
  origen     String   @db.VarChar(10)
  idOriginal Int                          // MOVDESTID
  nombre     String?  @db.VarChar(60)     // MOVDESTNOM
  latitud    Decimal? @db.Decimal(10, 7)  // MOVDESTX (UTM→WGS84)
  longitud   Decimal? @db.Decimal(10, 7)  // MOVDESTY
  direccion  String?  @db.VarChar(120)    // MOVDESTOBS
  moviles    Movil[]
  @@unique([origen, idOriginal])
  @@map("movil_destino")
}

model MovilIca {
  id             Int    @id @default(autoincrement())
  movilId        Int
  origen         String @db.VarChar(10)
  distribuidorId Int?                          // DISTID
  movil Movil @relation(fields: [movilId], references: [id], onDelete: Cascade)
  @@index([movilId])
  @@map("movil_ica")
}

model ClienteMovil {
  id        Int    @id @default(autoincrement())
  clienteId Int?                          // resuelto de CLIID (0→null)
  movilId   Int                            // CLIMOVID
  origen    String @db.VarChar(10)
  prioridad Int?                           // CLIMOVPRIO
  movil   Movil       @relation(fields: [movilId], references: [id], onDelete: Cascade)
  cliente ClienteUni? @relation(fields: [clienteId], references: [id])
  @@index([clienteId])
  @@index([movilId])
  @@map("cliente_movil")
}

model MovilHistorico {
  id      Int       @id @default(autoincrement())
  movilId Int
  origen  String    @db.VarChar(10)
  fecha   DateTime?                         // MOVHISEFCH
  accion  String?   @db.VarChar(40)        // MOVHISEST
  usuario String?   @db.VarChar(30)        // MOVHISTUSE
  detalle String?   @db.VarChar(200)       // MOVHISTDSC
  movil Movil @relation(fields: [movilId], references: [id], onDelete: Cascade)
  @@index([movilId])
  @@map("movil_historico")
}
```

En `model ClienteUni` agregar la back-relation: `movilesPreferidos ClienteMovil[]`.

- [ ] **Step 1:** Pegar los modelos al final de `schema.prisma` y agregar `movilesPreferidos ClienteMovil[]` en `ClienteUni`.
- [ ] **Step 2:** `cd backend && npx prisma format && npx prisma validate`.
- [ ] **Step 3:** `npx prisma db push` (crea las tablas; sin `--accept-data-loss` salvo que pida).
- [ ] **Step 4:** Commit: `feat(moviles): modelos prisma unificados (nombres amigables)`.

### Task M2: ETL catálogos — estados + servicios

**Files:** Create `backend/prisma/etl_movil_estados.py`, `backend/prisma/etl_servicios.py`.

- [ ] **Step 1:** `etl_movil_estados.py`: leer `PUESTOS.MOVESTADO` (MOVESTCOD,MOVESTNOM,MOVESTACT) → `movil_estado(origen='interior',...)`; `GXCALDTA.MOVESTAD` (MOVESTCOD,MOVESTNOM,MOVESTICA) → `origen='capital'`. `DELETE FROM movil_estado` antes.
- [ ] **Step 2:** `etl_servicios.py`: leer `GXCALDTA.SERVICIO` (SERID,SERNOM) → `servicio(origen='capital',idOriginal=SERID,nombre=SERNOM)`. `DELETE WHERE origen='capital'` antes.
- [ ] **Step 3:** Ejecutar ambos; verificar `movil_estado`=12 y `servicio`=count(SERVICIO). Commit: `feat(moviles-etl): catalogos estados + servicios`.

### Task M3: ETL empresas fleteras

**Files:** Create `backend/prisma/etl_fleteras.py`.

- [ ] **Step 1:** Interior `PUESTOS.EFLETERA` → `empresa_fletera(origen='interior', idOriginal=EFLID, puestoId=EFLPUESTOID, nombre=EFLNOM, razonSocial=EFLRAZONSOCIAL, direccion=EFLDIRECCION, telefono=EFLTEL, email=EFLMAIL, ruc=EFLRUC, estado=EFLESTADO, observaciones=EFLOBS, gpsId=EFLGPSEFLETERA)`.
- [ ] **Step 2:** Capital `GXCALDTA.EFLETERA` → `origen='capital', puestoId=100, baseOperativa=EFLUSER, nombre=EFLNOM, nombreComercial=EFLNOMCOMO, ruc=EFLRUC, telefono=EFLTEL, email=EFLMAIL, estado=EFLESTADO, observaciones=EFLOBS`; `direccion`= resolver `EFLCALID` vía catálogo `calle` (si existe el nombre) + `EFLNROPUER`, si no, dejar el nro/calle id como texto.
- [ ] **Step 3:** `DELETE WHERE origen=...` por lado. Ejecutar; verificar `empresa_fletera`≈222. Commit: `feat(moviles-etl): empresas fleteras`.

### Task M4: ETL destinos (capital)

**Files:** Create `backend/prisma/etl_movil_destinos.py`.

- [ ] **Step 1:** `GXCALDTA.MOVDESTI` → `movil_destino(origen='capital', idOriginal=MOVDESTID, nombre=MOVDESTNOM, direccion=MOVDESTOBS)`; `MOVDESTX/Y` UTM 21S→WGS84 (pyproj `Transformer.from_crs(32721,4326,always_xy=True)`), validar rango Uruguay o null.
- [ ] **Step 2:** Ejecutar; verificar `movil_destino`=256. Commit: `feat(moviles-etl): destinos`.

### Task M5: ETL móviles (maestro)

**Files:** Create `backend/prisma/etl_moviles.py`.

- [ ] **Step 1:** Cargar mapas de resolución desde Postgres: fletera `(origen,idOriginal)→id`, destino `(origen,idOriginal)→id`.
- [ ] **Step 2:** Interior `PUESTOS.MOVILES` → `movil(origen='interior', idOriginal=MOVID, fleteraId=map[('interior',MOVEFLID)] (null si huérfano + log), puestoId=MOVPUESTOID, estadoCodigo=MOVESTCOD, descripcion=MOVDSC, marca, modelo, matricula=MOVMAT, telefono=MOVTELFNRO, capacidadLote=MOVBOD13TOPE, servicioPrincipal=MOVSERVPRINCIPAL, latitud=MOVULTCOORDX, longitud=MOVULTCOORDY (ya en grados; validar), gpsMovilId=MOVGPSMOVID, distanciaMaxMetros, appPuedeDesactivar, permiteBajaMomentanea, numeroMovil=MOVNROMOVIL, observaciones=MOVOBS, firebaseEnviado/Eliminado, ultimaPosicionAt=MOVULTMODIFICACION)`.
- [ ] **Step 3:** Capital `GXCALDTA.MOVILES` → `origen='capital', puestoId=100, fleteraId=map[('capital',EFLID)], estadoCodigo=MOVESTCOD, marca/modelo, matricula=MOVMAT, telefono=MOVTELFNRO, capacidadLote=MOVT1, servicioPrincipal/tipoServicio=MOVTPOSERI, rutea=(MOVRUTEA=='S'), pedidosPendientes=MOVPEDPEND, latitud/longitud=MOVX/MOVY (UTM→WGS84, validar), tieneGps=MOVGPS, gpsReportando=MOVGPSOK, destinoId=map_destino[('capital',MOVDESTID)], activoDesde/Hasta=MOVACTDESD/HAST (YYYYMMDD→date), ultimaPosicionAt=MOVPOSFCHA`.
- [ ] **Step 4:** `DELETE WHERE origen=...` por lado (respeta cascade de hijos vacíos). Ejecutar; verificar `movil`=516, logs de huérfanos. Commit: `feat(moviles-etl): maestro de moviles`.

### Task M6: ETL sub-dominios capital

**Files:** Create `etl_movil_zonas.py`, `etl_movil_servicios.py`, `etl_movil_bodega_stock.py`, `etl_movil_horarios.py`, `etl_movil_ica.py`, `etl_movil_cantidades.py`.

- [ ] **Step 1:** Cargar mapa `movil (origen,idOriginal=MOVID)→id` y, para servicios, `servicio (origen,idOriginal=SERID)→id`.
- [ ] **Step 2:** Zonas: `MOVZONAS` → `movil_zona`. Servicios: `MOVSERV` → `movil_servicio(servicioId=map_serv[('capital',MOVSERID)])`. Bodega: `MOVBODEG`→`movil_bodega`; Stock: `MOVSTOCK`→`movil_stock`. Horarios: `MOVHORAR`→`movil_horario` (mapear id por (MOVID + idx) para luego ligar `MOVHORA1`→`movil_horario_dia`, `MOVHORA2`→`movil_horario_excepcion`). ICA: `MOVICAMO`→`movil_ica`. Cantidades: `MOVCANTX`→`movil_cantidad_objetivo`.
- [ ] **Step 3:** `DELETE` por tabla antes. Ejecutar todos; verificar counts (zona 537, servicio 1511, bodega 329, stock 308, horario 57/372/2, ica 304, cantidades 218). Commit: `feat(moviles-etl): subdominios (zonas/servicios/bodega/stock/horarios/ica/cantidades)`.

### Task M7: ETL cliente↔móvil

**Files:** Create `backend/prisma/etl_cliente_movil.py`.

- [ ] **Step 1:** Mapas: `movil (capital,MOVID)→id`, `cliente_uni (capital,idOriginal=CLIID)→id`.
- [ ] **Step 2:** `GXCALDTA.CLIMOVIL` → `cliente_movil(origen='capital', clienteId=map_cli[('capital',CLIID)] (null si CLIID=0 o no resuelve), movilId=map_mov[('capital',CLIMOVID)] (saltar si no resuelve + log), prioridad=CLIMOVPRIO)`.
- [ ] **Step 3:** Ejecutar; verificar `cliente_movil`≤507. Commit: `feat(moviles-etl): cliente-movil ligado a cliente_uni`.

### Task M8: Verificación final

- [ ] **Step 1:** Query de counts de todas las tablas; comparar con los esperados de la spec.
- [ ] **Step 2:** Spot-check joins: `SELECT m.matricula, f.nombre FROM movil m JOIN empresa_fletera f ON f.id=m."fleteraId" LIMIT 5`; `cliente_movil` join a `cliente_uni`; `movil_servicio` join a `servicio`.
- [ ] **Step 3:** Muestra de coords capital en rango Uruguay (`SELECT count(*) FROM movil WHERE origen='capital' AND latitud BETWEEN -35.5 AND -30`).
- [ ] **Step 4:** `git push origin dev`.

## Self-Review

- **Cobertura spec:** modelos (M1) cubren todas las tablas de la spec; ETLs (M2–M7) cubren estados/servicios/fleteras/destinos/móviles/subdominios/cliente_movil; histórico estructura-only (M1, sin ETL). ✓
- **Nombres amigables:** todos los campos en español; AS400 solo en comentarios. ✓
- **Consistencia:** `estadoCodigo`/`origen` resuelven `movil_estado`; `servicioId`→`servicio`; `clienteId`→`cliente_uni`; `fleteraId`/`destinoId` por mapas. ✓
- **Riesgos:** `MOVHORA1/2` ligan a `MOVHORAR` por (MOVID+orden) — verificar PK real en el ETL; coords interior `MOVULTCOORDX/Y` ya en grados (no UTM) — validar antes de tratar como UTM.
