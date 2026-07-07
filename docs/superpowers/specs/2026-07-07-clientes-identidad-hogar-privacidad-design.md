# Clientes: identidad única, hogar y privacidad por distribuidor — Goya / Postgres

**Fecha:** 2026-07-07
**Estado:** Diseño (brainstorming) — pendiente de aprobación para pasar a plan.
**Evoluciona:** `2026-06-24-modelo-unificado-clientes-design.md` (que ya migró interior+capital a
`cliente_uni` / `cliente_telefono` / `cliente_direccion`).
**Alcance de ESTA spec:** capa de **identidad única (Persona)**, **hogar / grupo familiar**,
**afiliación cliente↔distribuidor (Cobertura)**, **workbench de deduplicación** y **privacidad /
scoping por rol** (call center vs distribuidor). Pedidos, sync AS400↔goya y la UI fina quedan en
specs propias, pero esta spec deja los *hooks* listos.

---

## 1. Objetivo

Hoy `cliente_uni` tiene **una fila por registro del AS400** (`origen` + `idOriginal`): si la misma
persona real aparece en capital y en interior, o dos veces en el mismo sistema, son **filas
distintas**, y el dedup es apenas un **marcado** (`dedupGrupo` / `dedupRevisar`), nunca una fusión.
No existe concepto de "persona única" ni de "hogar".

Queremos:

1. **Vista única de cliente** (360) para el call center: una persona → todos sus registros,
   teléfonos, direcciones, hogar/familia, sin duplicados.
2. **Toma de pedidos limpia**: identificar a la persona por cédula/teléfono sin ambigüedad.
3. **Grupos familiares / hogar**: agrupar personas distintas que comparten dirección física.
4. **Workbench de deduplicación**: un lugar donde el operador ve los registros **en crudo** y va
   marcando "este es el mismo que aquel", alimentando la vista única. Nada se fusiona solo.
5. **Privacidad por distribuidor**: los distribuidores (empresas fleteras) toman pedidos directo de
   clientes, pero **no deben ver información que no les corresponde**.

---

## 2. Punto de partida (lo que ya existe, se conserva)

- `cliente_uni` (1.130.155), `cliente_telefono` (2.262.207), `cliente_direccion` (1.130.155).
- Catálogos: `puesto`, `departamento`, `localidad`, `tipo_cliente`, `categoria_precio`, `zona`.
- Móviles / empresas fleteras unificadas (`movil`, `empresa_fletera`, …).
- Zonificación geo: `zona_operativa` (polígonos, tipo `DISTRIBUCION`|`FLETE`), espejada con TrackMovil.
- Auth/roles → **SecuritySuite (secapi)**; los datos de negocio → NestJS → Postgres goya.

**Principio rector:** lo **crudo nunca se destruye**. `cliente_uni` + sus tel/dir son la fuente
auditable que vino del AS400. Todo lo nuevo se construye **por encima**, y las operaciones de
unificación/hogar son **reversibles**.

---

## 3. Decisiones tomadas (con el usuario)

1. **Capa Persona + Hogar** (modelo *party*), no fusión destructiva del crudo (Opción A).
2. **Persona curada**: datos oficiales elegidos por el operador (nombre, cédula, tel/dir principal),
   además de agregar el resto de tel/dir de todos los registros vinculados.
3. **Hogar = M:N**: una persona puede pertenecer a más de un hogar (su casa y la de sus padres).
4. **Hogar se sugiere automáticamente** por misma dirección física; el operador **confirma en un
   modal**. Refuerzo futuro: pedidos a esa dirección en el mismo año.
5. **Cobertura = afiliación por interacción**, NO polígono: un cliente "es de" un distribuidor porque
   **llamó directo a su punto de venta** o porque **un móvil de esa fletera le entregó**.
6. **Distribuidor = `empresa_fletera`.**
7. **Geo (polígono) = señal secundaria opcional**: solo sugiere distribuidor por defecto para un
   cliente 100% nuevo sin relación previa.
8. **Identificar ≠ buscar**: el distribuidor hace *lookup por identificador exacto* (cédula / tel
   completo), no listado ni búsqueda parcial → evita "pesca" de datos.
9. **Privacidad por rol**:
   - **Call center central** → 360 completo (N tel, N dir, hogar, familia, cédula, obs).
   - **Distribuidor sin afiliación** → tarjeta mínima (solo nombre).
   - **Distribuidor con afiliación** → ficha scoped: nombre, estado, **cédula sí**, **obs no**, y en
     vez de todos los tel/dir, **solo el último teléfono usado y la última dirección usada**.
10. **`ultFecha`** en `cliente_telefono` y `cliente_direccion` = fecha del último pedido hecho por ese
    teléfono / a esa dirección (lo puebla el subsistema de pedidos).

---

## 4. Modelo de datos

### 4.1 Las capas

```
                         ┌─────────────────────────────┐
                         │           HOGAR             │  grupo familiar (personas
                         │  1 dirección física común   │  distintas), M:N con persona
                         └──────────────┬──────────────┘
                                        │ hogar_miembro (M:N)
                         ┌──────────────┴──────────────┐        ┌───────────────────────┐
   identidad ÚNICA →     │           PERSONA           │───────▶│  COBERTURA (afiliación)│──▶ EMPRESA_FLETERA
   global, compartida    │ nombre oficial · cédula     │  N     │ LLAMADA_DIRECTA/ENTREGA│    (+ puesto/escenario)
                         │ tel/dir principal (FK)      │        │ ultFecha               │
                         └──────────────┬──────────────┘        └───────────────────────┘
                                        │ 1:N  (personaId)
        lo "en crudo",   ┌──────────────┴──────────────┐
        auditable,       │   CLIENTE_UNI (registro)    │  ← lo que ya vino del AS400
        inmutable        │   origen + idOriginal       │
                         └───┬───────────────────┬─────┘
                    1:N ─────┘                   └───── 1:N
             ┌────────────────────┐     ┌─────────────────────────┐
             │  CLIENTE_TELEFONO  │     │    CLIENTE_DIRECCION     │
             │  + ultFecha        │     │  + ultFecha              │
             └────────────────────┘     └─────────────────────────┘
```

### 4.2 Entidades nuevas (Prisma)

```prisma
// Identidad real, curada. Agrupa 1..N registros crudos (cliente_uni).
model Persona {
  id                   Int       @id @default(autoincrement())
  nombreOficial        String?   @db.VarChar(80)
  cedula               String?   @db.VarChar(12)   // única cuando existe
  rucPrincipal         String?   @db.VarChar(12)
  telefonoPrincipalId  Int?                          // FK → cliente_telefono (elegido del crudo)
  direccionPrincipalId Int?                          // FK → cliente_direccion (elegido del crudo)
  estado               String?   @db.VarChar(1)
  notasInternas        String?   @db.VarChar(300)   // solo call center
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  registros   ClienteUni[]                           // los crudos vinculados
  miembroDe   HogarMiembro[]
  coberturas  Cobertura[]
  telefonoPrincipal  ClienteTelefono?  @relation("PersonaTelPrincipal", fields: [telefonoPrincipalId], references: [id])
  direccionPrincipal ClienteDireccion? @relation("PersonaDirPrincipal", fields: [direccionPrincipalId], references: [id])

  @@unique([cedula])          // parcial: solo aplica cuando cedula no es null (índice único filtrado)
  @@index([nombreOficial])
  @@index([rucPrincipal])
  @@map("persona")
}

// Grupo familiar anclado a una dirección física.
model Hogar {
  id                Int       @id @default(autoincrement())
  etiqueta          String?   @db.VarChar(120)   // "Familia Pérez – Av. Italia 2020"
  direccionTextoNorm String?  @db.VarChar(300)   // clave normalizada calle+nº
  lat               Decimal?  @db.Decimal(10, 7)
  lng               Decimal?  @db.Decimal(10, 7)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  miembros          HogarMiembro[]

  @@index([direccionTextoNorm])
  @@map("hogar")
}

model HogarMiembro {
  id        Int      @id @default(autoincrement())
  hogarId   Int
  personaId Int
  rol       String?  @db.VarChar(20)   // TITULAR | FAMILIAR (opcional)
  hogar     Hogar    @relation(fields: [hogarId], references: [id], onDelete: Cascade)
  persona   Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)

  @@unique([hogarId, personaId])
  @@index([personaId])
  @@map("hogar_miembro")
}

// Cola del workbench: candidatos a duplicado o a hogar. Nada se fusiona solo.
model MatchSugerencia {
  id          Int       @id @default(autoincrement())
  tipo        String    @db.VarChar(20)   // DUPLICADO | HOGAR
  registroA   Int?                          // cliente_uni.id (para DUPLICADO)
  registroB   Int?
  personaA    Int?                          // persona.id (para HOGAR)
  personaB    Int?
  senal       String    @db.VarChar(30)    // CEDULA | RUC | TEL+NOMBRE | MISMA_DIRECCION | ...
  confianza   Float                          // 0-1
  estado      String    @db.VarChar(12) @default("PENDIENTE") // PENDIENTE | ACEPTADO | RECHAZADO
  operador    String?   @db.VarChar(30)
  resueltoAt  DateTime?
  createdAt   DateTime  @default(now())

  @@index([tipo, estado, confianza(sort: Desc)])
  @@map("match_sugerencia")
}

// Afiliación cliente↔distribuidor por interacción. Poblada por pedidos (backfill histórico).
model Cobertura {
  id               Int      @id @default(autoincrement())
  personaId        Int
  puestoId         Int                       // escenario / punto de venta
  empresaFleteraId Int                       // el distribuidor
  tipoInteraccion  String   @db.VarChar(20)  // LLAMADA_DIRECTA | ENTREGA_MOVIL
  primeraFecha     DateTime?
  ultFecha         DateTime
  cantPedidos      Int?     @default(0)
  persona          Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)

  @@unique([personaId, empresaFleteraId])   // 1 relación por distribuidor; se actualiza ultFecha
  @@index([empresaFleteraId])
  @@map("cobertura")
}
```

### 4.3 Cambios a lo existente

```prisma
model ClienteUni {
  // ...campos actuales...
  personaId  Int?                            // NUEVO → persona
  persona    Persona? @relation(fields: [personaId], references: [id])
  @@index([personaId])
}

model ClienteTelefono {
  // ...campos actuales...
  ultFecha   DateTime?                       // NUEVO: último pedido por este teléfono
}

model ClienteDireccion {
  // ...campos actuales...
  ultFecha          DateTime?                // NUEVO: último pedido a esta dirección
  territorioPuestoId Int?                    // NUEVO opcional: puesto resuelto por geo (señal secundaria)
}
```

> `dedupGrupo` / `dedupRevisar` de `cliente_uni` quedan **deprecados** (los reemplaza
> `persona` + `match_sugerencia`); se pueden mantener durante la transición y dropear al final.

---

## 5. Identidad y deduplicación (workbench)

**Migración inicial (1:1):** cada `cliente_uni` recibe una **persona-de-uno** (`personaId` propio).
Así la vista única es siempre un join simple. **Unificar** = repuntar 2+ registros a una misma
persona y retirar las personas que quedaron vacías (reversible, el crudo intacto).

**Motor de sugerencias → `match_sugerencia` (estado PENDIENTE):**

*Duplicado (misma persona), por confianza:*
1. `cedula` exacta (cuando exista) — altísima.
2. `ruc` válido exacto — alta.
3. `teléfono activo` compartido **+ nombre similar** (rapidfuzz ≥ 0.85) — media.

*Hogar (personas distintas, misma casa):*
1. Misma dirección física — dos vías, en orden:
   - **(a) Clave textual exacta**: igual `direccionTextoNorm` (ver §5.1).
   - **(b) Proximidad geo**: ambas con lat/lng y distancia **< `HOGAR_PROXIMIDAD_METROS`**
     (configurable, default **25 m**). Si comparten coordenada de edificio pero difiere el apto →
     se sugiere igual pero **flagueado** (`senal=MISMA_DIRECCION_APTO_DISTINTO`); decide el operador.
2. Refuerzo futuro: pedidos a esa dirección en el mismo año.

### 5.1 Normalización de dirección (`direccionTextoNorm`)

Clave estable para agrupar hogares. Se arma **desde los campos estructurados** de
`cliente_direccion` (no del texto libre), en este orden:

1. **Componer** `{departamentoId}|{localidadId}|{calle}|{nro}|{apto}`. El apto/unidad **entra en la
   clave**: dos familias en aptos distintos del mismo edificio **no** son el mismo hogar.
2. **Mayúsculas** + **quitar acentos** (NFD → remover diacríticos): `Á`→`A`.
3. **Quitar puntuación** (`. , ° º # -`) y **colapsar espacios**.
4. **Canonizar el tipo de vía** con una tabla de abreviaturas (dict configurable):
   `AVENIDA|AVDA|AV.` → `AV`; `BULEVAR|BVAR|BR` → `BV`; `GENERAL|GRAL` → `GRAL`;
   `DOCTOR|DR` → `DR`; `CORONEL|CNEL` → `CNEL`; `INGENIERO|ING` → `ING`;
   `CAMINO|CNO` → `CNO`; `RUTA|RTA` → `RUTA`; `CALLE` → `` (se omite).
5. **Número**: extraer dígitos, **quitar ceros a la izquierda**; conservar sufijo `BIS`/letra si hay.
6. **Apto/unidad**: quitar prefijos (`APTO|AP|APARTAMENTO|UNIDAD`) y dejar el identificador.
7. **Resultado**: `DEP|LOC|VIA_CANON NRO|APTO` (ej. `MO|MONTEVIDEO|AV ITALIA 2020|301`).
8. **Direcciones pobres** (sin calle o sin nº) → **no** se genera clave textual; se cae **solo** a
   proximidad geo (5.1.b). Nunca se agrupa por clave vacía.

La distancia y la tabla de abreviaturas viven en **configuración** (env o tabla `config`), no
hardcodeadas, para calibrar sin redeploy.

**Workbench (pantalla del operador):**
- Ve los **registros crudos** tal cual + la cola de `match_sugerencia` ordenada por confianza.
- Acciones: **unificar** registros → persona, **elegir datos canónicos** (nombre, cédula, tel/dir
  principal), **armar/confirmar hogar** (modal), **rechazar** sugerencia, **deshacer**.
- Búsqueda manual para lo que el motor no sugirió.

---

## 6. Privacidad / scoping por rol

Roles desde **secapi**: `CALL_CENTER` (central) y `DISTRIBUIDOR` (atado a un `empresaFleteraId`).
La **misma** persona global se proyecta distinto según el rol y la afiliación (`cobertura`).

| Aspecto | Call center | Distribuidor SIN afiliación | Distribuidor CON afiliación |
|---|---|---|---|
| Buscar / listar | Sí (360) | **No** — lookup exacto | **No** — lookup exacto |
| Identidad | Todo | Solo **nombre** | Nombre, estado, **cédula** |
| Teléfonos | Todos (N) | — | **Solo el de `ultFecha` más reciente** |
| Direcciones | Todas (N) | — | **Solo la última usada** (+ las de su relación) |
| Hogar / familia | Sí | No | No |
| Observaciones / notas | Sí | No | **No** |
| Otras zonas / distribuidores | Sí | No | No |

- **Row-level:** direcciones/pedidos filtrados por relación (`cobertura`) del distribuidor.
- **Field-level:** el servicio de identificación devuelve un **DTO redactado** según rol+afiliación
  (nunca se serializa la persona completa hacia un distribuidor).
- **Anti-pesca:** el distribuidor no puede listar ni buscar parcial; solo *lookup por identificador
  exacto*.

---

## 7. Flujo de toma de pedido del distribuidor (3 desenlaces)

```
Distribuidor pide dato identificatorio (cédula / tel completo)
        │
        ├─ servicio de identificación (scope elevado) → resuelve Persona global
        │
        ├─(1) match + dirección dada es servible por él
        │        (afiliación existente, o geo territorial como señal secundaria)
        │        → agrega la dirección a la persona, crea/actualiza cobertura,
        │          genera pedido para ese distribuidor
        │
        ├─(2) match, pero la persona NO tiene dirección/relación con su zona
        │        → muestra solo NOMBRE + "dá de alta tu dirección de esta zona"
        │        → al dar de alta: crea dirección + cobertura(LLAMADA_DIRECTA) + pedido
        │
        └─(3) sin match
                 → alta nueva (persona + registro + dirección) + cobertura + pedido
```

La creación del pedido en sí y la escritura de `ultFecha` / `cobertura` las hace el **subsistema de
pedidos** (spec aparte). Esta spec entrega los hooks: `cobertura`, `ultFecha`, el servicio de
identificación redactado y el routing dirección→distribuidor.

---

## 8. Migración / backfill

1. **Schema** (`prisma db push`): `persona`, `hogar`, `hogar_miembro`, `match_sugerencia`,
   `cobertura`; columnas nuevas en `cliente_uni` / `cliente_telefono` / `cliente_direccion`.
2. **Persona-de-uno**: crear 1 `persona` por cada `cliente_uni` y setear `personaId`
   (`nombreOficial`=nombre, `telefonoPrincipalId`/`direccionPrincipalId`=el principal actual).
3. **Motor de sugerencias**: correr las reglas de §5 → poblar `match_sugerencia` (adaptar el
   `dedup_clientes.py` existente).
4. **Hogares**: sugerencias por dirección normalizada → `match_sugerencia` tipo HOGAR.
5. **Cobertura**: se puebla al llegar pedidos (backfill de pedidos históricos cuando existan).
6. **Geo territorial** (opcional): resolver `territorioPuestoId` por point-in-polygon contra
   `zona_operativa` para la señal secundaria.

---

## 9. Alcance

- **Dentro:** persona, hogar (M:N), cobertura (afiliación), workbench/dedup, `match_sugerencia`,
  scoping por rol, servicio de identificación redactado, columnas `ultFecha`, routing
  dirección→distribuidor (con geo como señal secundaria).
- **Fuera (spec propia, hooks listos):** subsistema de **pedidos** (crea pedidos, escribe `ultFecha`
  y `cobertura`), **sync bidireccional** AS400↔goya, **UI fina** del call center y del portal
  distribuidor, backfill de coberturas desde pedidos históricos.

---

## 10. Riesgos / pendientes

- **`persona.cedula` única cuando existe**: requiere índice único **parcial** (`WHERE cedula IS NOT
  NULL`) — Prisma no lo expresa nativo, se crea con SQL crudo en la migración.
- **Cobertura depende de pedidos**: hasta tener pedidos migrados, la afiliación se llena solo con
  altas nuevas; los clientes históricos quedan sin afiliación (verían tarjeta mínima). Mitigar con
  backfill de pedidos históricos apenas estén.
- **Normalización de dirección** para hogar (`direccionTextoNorm`): algoritmo definido en §5.1;
  la tabla de abreviaturas y `HOGAR_PROXIMIDAD_METROS` (default 25 m) son **configurables**.
- **Roles/afiliación en secapi**: CONFIRMADO — el distribuidor logueado trae su `empresaFleteraId`
  desde secapi; el backend lo usa para el scoping row/field-level. (AplicacionId goya = 3.)
- **Solapes de cobertura**: una persona puede tener afiliación con >1 distribuidor (llamó a dos PDV);
  cada uno ve su propia relación — está contemplado por `@@unique([personaId, empresaFleteraId])`.
- **Deprecación** de `dedupGrupo`/`dedupRevisar` y del `cliente` plano viejo: al final de la
  transición.
