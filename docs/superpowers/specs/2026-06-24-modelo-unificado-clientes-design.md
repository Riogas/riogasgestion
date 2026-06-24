# Modelo unificado de Clientes (interior + capital) — Goya / Postgres

**Fecha:** 2026-06-24
**Estado:** Diseño (brainstorming) — pendiente de aprobación para pasar a plan.
**Alcance de ESTA spec:** clientes + direcciones + teléfonos + catálogos asociados, y la
migración de ambos orígenes a Postgres. Pedidos y configuración operativa = specs aparte.

---

## 1. Objetivo

Riogas tiene hoy **dos sistemas de clientes** en el AS400:
- **Interior** (resto del país) → esquema **`PUESTOS`**.
- **Capital** (Montevideo) → esquema **`GXCALDTA`**.

Se quiere **un solo sistema (goya)** sobre **PostgreSQL** que cubra ambos: configuración,
toma de pedidos y altas de clientes. **goya pasa a ser el master**; durante la construcción
puede haber **sync bidireccional** transitorio con el AS400.

Esta spec define el **modelo de datos unificado de clientes** y la **migración** de los dos
orígenes (más lo ya migrado de GXCALDTA que hay que re-dimensionar).

---

## 2. Hallazgos — los dos sistemas son estructuralmente distintos

| | **PUESTOS** (interior) | **GXCALDTA** (capital) |
|---|---|---|
| Clientes | `PUESTOS.CLIENTE` — **196.191** | `GXCALDTA.CLIENTE` — **933.959** (ya en goya, plano) |
| PK origen | **CLIPUESTOID + CLIID** (cliente por puesto) | **CLIID** (global) |
| Estructura | normalizada: CLIENTE + CLIENTEDIRECCION + CLITEL + catálogos | plana (dirección embebida) |
| Calle | ID **+ nombre inline** (`CALPRINNOM`) | solo ID (resuelto vía catálogo `calle`, ya migrado) |
| Direcciones | **1:N** (`CLIENTEDIRECCION`, 9.865 filas, con lat/lon) + embebida en CLIENTE | 1 (embebida en CLIENTE) |
| Teléfonos | `PUESTOS.CLITEL` — **197.123** (estado `CLITELESTADO`) | `GXCALDTA.TELCLI` — **2.135.139** (estado `CLITELESTA`) |
| Coordenadas | `CLICOORDX/Y` + lat/lon en CLIENTEDIRECCION | 3 pares (DIRCOR/SAD/ICA) → **ya normalizadas** + geoinversa hecha |
| Geo refs | DEPARTAMENTO(19), LOCALIDAD(1406, con lat/lon), CIUDAD(159), ZONA(280→puesto) | zona, radio (Montevideo = 1 departamento) |
| Negocio extra | puntos (`CLIPUNTOSSALDO`), flete, categorías de precio (`CLICATPRECIOID`), garrafas | servicios (`tipoServicioId`) |
| Catálogo puestos | `PUESTOS.PUESTOS` — **18** (Maldonado, Salto, Rivera…) c/config | — (Montevideo no es puesto) |

**Notas importantes:**
- Los **CLIID colisionan** entre esquemas (un "1234" existe en ambos y son clientes distintos).
- En interior **el cliente está particionado por puesto**; en goya el puesto se mueve a la **dirección**.
- **Cédula NO existe** en ninguno de los dos orígenes → campo nuevo en goya (nullable, indexado).
- `PUESTOS.CLIENTETELEFONO` (49M filas) **NO se usa** — la tabla real de teléfonos es `CLITEL`.

---

## 3. Decisiones tomadas (con el usuario)

1. **goya = master**; sync bidireccional transitorio durante la construcción.
2. **ID nuevo surrogate** + `id_original` + `origen` (`interior`|`capital`). **El puesto NO va en
   `cliente`** — va en la **dirección**.
3. **Cédula**: campo nuevo en `cliente`, **no obligatorio hoy**, dato único a futuro para unificar
   → con índice.
4. **Sacar de `cliente` todo lo de teléfono y dirección** → tablas asociadas `cliente_telefono` y
   `cliente_direccion`.
5. **El puesto vive en la dirección** ("punto de venta" dentro de un departamento). Hay catálogo de
   **puesto** (nombre, departamento, localidad opcional, config). Para los clientes **de capital**
   (GXCALDTA) las direcciones se asocian a un **puesto nuevo "Montevideo"**.
6. **Calles**: se **elimina** el catálogo `calle`. La calle queda como **texto** dentro de la dirección
   (ya no hace falta catálogo teniendo geolocalización + Nominatim/Overpass propios).
7. **Incluir todos** los campos de negocio de ambos (nullable según origen).
8. **Dedup** (intentar unificar): por **RUC**; o por **teléfono activo** (`estado='A'`) compartido entre
   dos clientes **+ nombre similar**. Lo que no se pueda unificar → **queda duplicado** para depurar
   manual después.

---

## 4. Modelo unificado (PostgreSQL, vía Prisma)

> Tipos en estilo Prisma. `@db.*` indica el tipo Postgres real. Todo lo proveniente del AS400 se
> limpia (trim de CHAR, fechas `YYYYMMDD`/`TIMESTMP` → `DateTime`, decimales `0`→NULL donde aplique).

### 4.1 `cliente` (slim — sin dirección ni teléfono)

```prisma
model Cliente {
  id                Int       @id @default(autoincrement())   // surrogate goya
  origen            String    @db.VarChar(10)                 // 'interior' | 'capital'
  idOriginal        Int                                       // CLIID del AS400
  // identidad
  nombre            String?   @db.VarChar(60)
  ruc               String?   @db.VarChar(12)
  cedula            String?   @db.VarChar(12)                 // NUEVO, nullable, único a futuro
  email             String?   @db.VarChar(60)
  estado            String?   @db.VarChar(1)
  tipoClienteId     Int?                                      // → tipo_cliente
  vip               Boolean?
  // comercial / negocio (unión de ambos; nullable según origen)
  observaciones        String?  @db.VarChar(200)
  observacionesComerc  String?  @db.VarChar(80)
  puntosSaldo          Int?                                   // interior (CLIPUNTOSSALDO)
  fleteCobra           String?  @db.VarChar(2)                // interior (CLIFLETECOBRA)
  fleteCantidad        String?  @db.VarChar(2)                // interior (CLIFLETECANTIDAD)
  categoriaPrecioId    Int?                                   // interior (CLICATPRECIOID) → categoria_precio
  tipoServicioId       Int?                                   // capital (CLISERVTID)
  gciNro               String?  @db.VarChar(6)
  // fechas / auditoría
  fechaAlta            DateTime?
  ultimaLlamada        DateTime?
  operadorAlta         String?  @db.VarChar(15)
  operadorModificacion String?  @db.VarChar(15)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  telefonos   ClienteTelefono[]
  direcciones ClienteDireccion[]
  tipoCliente TipoCliente? @relation(fields: [tipoClienteId], references: [id])

  @@unique([origen, idOriginal])   // trazabilidad / sync
  @@index([nombre])
  @@index([ruc])
  @@index([cedula])
  @@index([estado])
  @@map("cliente")
}
```

### 4.2 `cliente_telefono` (1:N)

```prisma
model ClienteTelefono {
  id        Int     @id @default(autoincrement())
  clienteId Int
  numero    String  @db.VarChar(20)
  tipo      String? @db.VarChar(2)    // PUESTOS.TELTIPO (PE…) — capital no tiene
  estado    String? @db.VarChar(1)    // 'A' activo (PUESTOS.CLITELESTADO / GXCALDTA.CLITELESTA)
  alias     String? @db.VarChar(60)
  obs       String? @db.VarChar(60)   // capital (CLITELOBS)
  principal Boolean @default(false)
  cliente   Cliente @relation(fields: [clienteId], references: [id], onDelete: Cascade)

  @@index([clienteId])
  @@index([numero])                    // para dedup por teléfono
  @@map("cliente_telefono")
}
```

### 4.3 `cliente_direccion` (1:N — acá vive el puesto y la geo)

```prisma
model ClienteDireccion {
  id             Int      @id @default(autoincrement())
  clienteId      Int
  puestoId       Int?                              // ← el puesto vive acá
  departamentoId Int?
  localidadId    Int?                              // opcional
  // dirección como TEXTO (sin catálogo de calles)
  direccion      String?  @db.VarChar(300)         // texto completo armado (calle+nro+esquinas+…)
  calle          String?  @db.VarChar(150)
  nro            String?  @db.VarChar(40)
  esquina1       String?  @db.VarChar(150)
  esquina2       String?  @db.VarChar(150)
  bis            String?  @db.VarChar(1)
  apto           String?  @db.VarChar(40)
  blockSolar     String?  @db.VarChar(40)
  nivel          String?  @db.VarChar(40)
  local          String?  @db.VarChar(40)
  nroLocal       String?  @db.VarChar(40)
  manzana        String?  @db.VarChar(40)
  km             String?  @db.VarChar(40)
  observaciones  String?  @db.VarChar(60)
  // geolocalización + verificación (de la feature 2026-06-23)
  lat            Decimal? @db.Decimal(10, 7)
  lng            Decimal? @db.Decimal(10, 7)
  geoFuente      String?  @db.VarChar(10)          // sad|ica|dircor|clienteDireccion
  calleMatch     Boolean?                          // ✓/✗ geoinversa vs registrada
  geoVerificadoAt DateTime?
  // negocio de la dirección (interior)
  cantGarrafas   Int?
  usoGarrafa     String?  @db.VarChar(40)
  tipoProducto   String?  @db.VarChar(1)
  principal      Boolean  @default(false)
  estado         String?  @db.VarChar(1)
  cliente        Cliente  @relation(fields: [clienteId], references: [id], onDelete: Cascade)

  @@index([clienteId])
  @@index([puestoId])
  @@index([departamentoId, localidadId])
  @@index([calleMatch])
  @@map("cliente_direccion")
}
```

### 4.4 Catálogos

```prisma
model Puesto {              // PUESTOS.PUESTOS (18) + "Montevideo" nuevo para capital
  id              Int     @id                       // PUESTOID original; Montevideo = id reservado
  nombre          String? @db.VarChar(40)           // PUESTODSC
  direccion       String? @db.VarChar(100)
  departamentoId  Int?
  zonaId          Int?
  fleteCobra      String? @db.VarChar(2)
  fleteCantidad   String? @db.VarChar(2)
  autopedido      String? @db.VarChar(1)
  horarios        String? @db.VarChar(200)
  mail            String? @db.VarChar(100)
  propio          String? @db.VarChar(1)
  lat             Decimal? @db.Decimal(12,7)
  lng             Decimal? @db.Decimal(12,7)
  estado          String? @db.VarChar(1)
  @@map("puesto")
}

model Departamento {        // PUESTOS.DEPARTAMENTO (19)
  id     Int     @id
  nombre String? @db.VarChar(60)
  estado String? @db.VarChar(1)
  @@map("departamento")
}

model Localidad {           // PUESTOS.LOCALIDAD (1406, con lat/lon)
  id             Int     @id
  departamentoId Int?
  nombre         String? @db.VarChar(60)
  lat            Decimal? @db.Decimal(10,5)
  lng            Decimal? @db.Decimal(10,5)
  estado         String? @db.VarChar(1)
  @@index([departamentoId])
  @@map("localidad")
}

model TipoCliente {         // PUESTOS.TIPOCLIENTE (29) (+ unificar con tipos de GXCALDTA)
  id          Int     @id
  descripcion String? @db.VarChar(60)
  estado      String? @db.VarChar(1)
  @@map("tipo_cliente")
}

model CategoriaPrecio {     // PUESTOS.CATEGORIA (6)
  id       Int     @id
  puestoId Int?
  nombre   String? @db.VarChar(40)
  activo   String? @db.VarChar(1)
  @@map("categoria_precio")
}

model Zona {                // PUESTOS.ZONA (280, → puesto)
  id           Int     @id
  puestoId     Int?
  nombre       String? @db.VarChar(30)
  fleteCobra   String? @db.VarChar(2)
  fleteCantidad String? @db.VarChar(2)
  estado       String? @db.VarChar(1)
  @@index([puestoId])
  @@map("zona")
}
```

> **Se elimina** el modelo `Calle` actual (catálogo de calles) — la calle pasa a texto en
> `cliente_direccion`. La tabla `calle` de goya se dropea tras migrar la dirección a texto.

---

## 5. Mapeo de migración (campo por campo)

### 5.1 Catálogos (primero)
`PUESTOS.{PUESTOS, DEPARTAMENTO, LOCALIDAD, TIPOCLIENTE, CATEGORIA, ZONA}` → tablas homónimas en goya
(1:1, limpiando CHAR). Crear **puesto "Montevideo"** (id reservado, ej. 100) para capital.

### 5.2 Clientes
**Capital (re-dimensionar lo ya migrado: goya.`cliente` plano → nuevo modelo):**
- `cliente` slim ← campos no-dirección/teléfono del `cliente` plano actual. `origen='capital'`,
  `idOriginal=id` actual (=CLIID). `cedula`=null.
- `cliente_direccion` ← dirección embebida del `cliente` plano **+ la geo ya calculada**
  (`direccion`, `lat/lng`, `geoFuente`, `calleMatch`, `geoVerificadoAt`). `puestoId`=**Montevideo**.
  `departamentoId`=Montevideo; `localidadId` de la geoinversa si se tiene.
- `cliente_telefono` ← **`GXCALDTA.TELCLI`** por CLIID (numero, estado `CLITELESTA`, obs).

**Interior (`PUESTOS` → nuevo modelo):**
- `cliente` slim ← `PUESTOS.CLIENTE` (nombre, ruc, email, estado, tipoCliente, vip, puntos, flete,
  categoríaPrecio, gci, fechas, operadores). `origen='interior'`, `idOriginal=CLIID`.
- `cliente_direccion` ← (a) la **embebida** en `PUESTOS.CLIENTE` (CALPRINNOM, NROPUERTA, esquinas NOM,
  bis/apto/solar/km, CLICOORDX/Y, DEPARTAMENTOID/CIUDADID/ZONID, `puestoId=CLIPUESTOID`); **y** (b) las
  filas **1:N** de `PUESTOS.CLIENTEDIRECCION` (DIRECCIONCALLE/NRO/ESQ…, lat/lon, garrafas, uso). Marcar
  `principal` la mejor. El texto `direccion` se arma concatenando.
- `cliente_telefono` ← **`PUESTOS.CLITEL`** por (CLIPUESTOID, CLIID) (numero, tipo, estado `CLITELESTADO`).

### 5.3 Geo
La verificación de coordenadas (lat/lng + `calleMatch` + `direccion` texto) vive ahora en
`cliente_direccion` y se **re-corre para ambos orígenes** con el backfill existente adaptado.

---

## 6. Deduplicación

Objetivo: clientes únicos donde se pueda; lo dudoso queda duplicado para limpieza manual.

**Reglas (en orden):**
1. **Mismo RUC** válido (no 0/nulo) → mismo cliente.
2. **Mismo teléfono activo** (`estado='A'`) presente en dos clientes **+ nombre similar**
   (Levenshtein/normalizado ≥ umbral) → mismo cliente.
3. **Cédula** (a futuro): cuando se cargue, igualar por cédula.

**Implementación:** pasada de detección post-migración que agrupa candidatos y los marca
(`dedup_grupo`, `dedup_revisar`) sin fusionar destructivamente; la fusión real (elegir el "master"
del grupo y reapuntar direcciones/teléfonos) se hace en una pasada revisable. Si no hay match →
quedan como clientes separados.

---

## 7. Sync transitorio (goya master, AS400 espejo durante construcción)

Subsistema aparte (spec propia), pero a alto nivel:
- **AS400 → goya:** ETL incremental (delta por `CLIULTLLAMADA`/timestamps o journaling) de ambos
  esquemas hacia las nuevas tablas, idempotente por `(origen, idOriginal)`.
- **goya → AS400:** las altas/ediciones hechas en goya se reflejan en el esquema correspondiente
  (PUESTOS o GXCALDTA) hasta el corte final.
- **Corte:** cuando goya sea master pleno, se apaga el sync y el AS400 queda read-only / archivado.

---

## 8. Fases de implementación (orden sugerido)

1. **Schema nuevo en goya** (Prisma): catálogos + `cliente`/`cliente_telefono`/`cliente_direccion`;
   crear puesto "Montevideo". `prisma db push`.
2. **Migrar catálogos** del AS400.
3. **Re-dimensionar capital**: partir el `cliente` plano actual → nuevas tablas (conservando la geo).
4. **Migrar teléfonos capital** (`GXCALDTA.TELCLI`).
5. **Migrar interior** (`PUESTOS`): clientes + direcciones (embebida + 1:N) + teléfonos (`CLITEL`).
6. **Re-correr geo** (backfill) sobre `cliente_direccion` de ambos orígenes.
7. **Dedup**: pasada de detección + revisión.
8. **Adaptar backend/front** (módulo clientes) al nuevo modelo (cliente + tabs direcciones/teléfonos).
9. **Sync transitorio** (spec/fase aparte).
10. **Dropear** `calle` y el `cliente` plano viejo cuando todo esté validado.

---

## 9. Riesgos / pendientes

- **Estados de teléfono** difieren por esquema (`CLITELESTADO` vs `CLITELESTA`) y los valores pueden
  no ser homogéneos ('A' vs 'P'…). Normalizar a un set común (`A`=activo).
- **TipoCliente** y **categorías**: los IDs de interior y capital pueden no coincidir → puede hacer
  falta una tabla de mapeo o un `origen` en el catálogo. (A confirmar cuando lleguemos a configuración.)
- **Direcciones 1:N de interior** (`CLIENTEDIRECCION`) solo cubren 9.865 de 196k → para el resto la
  dirección sale de la embebida en `CLIENTE`.
- **Puesto en la dirección**: el detalle fino de cómo se asigna/usa el puesto el usuario lo definirá
  más adelante; acá queda como FK nullable.
- **Pedidos y configuración**: fuera de alcance de esta spec (specs propias).
