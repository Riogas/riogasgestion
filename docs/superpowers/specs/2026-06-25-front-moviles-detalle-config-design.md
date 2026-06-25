# Pantalla Detalle/Configuración de Móvil (/dashboard/moviles/[id]) — Diseño

**Fecha:** 2026-06-25
**Estado:** Aprobado (datos reales, escritura en goya) — pendiente implementar
**Relacionados:** `2026-06-25-front-moviles-admin-design.md` (lista), `2026-06-24-merge-moviles-fleteras-design.md` (modelo).

## Objetivo

Pantalla de detalle/edición/configuración de un móvil (`/dashboard/moviles/[id]`) que **unifica** las pantallas viejas "Modificar móvil" + "Configuración ICA/Obelix". Datos REALES; **escritura a Postgres goya** (diverge de AS400 hasta la sync, igual que clientes). Layout/estética según el prompt del usuario (dark corporativo, 2 columnas: resumen fijo izq + tabs/forms der; tabs Configuración/Historial/Servicios/Bodega/Actividad; secciones 1-7).

## Decisiones (usuario)
1. **Extender el modelo `movil` + re-ETL** para traer los campos de config de AS400 que no migramos.
2. Los campos **sin fuente clara** = **campos nuevos de goya** (editables, default null/false).
3. **Escritura completa a goya** (móvil + sub-tablas).
4. Reusar el layout de goya; construir solo el contenido.

## Extensión del modelo Prisma (`backend/prisma/schema.prisma`, model `Movil`)

Agregar (NOMBRES AMIGABLES):
```prisma
// --- Config traída de AS400 (poblar por re-ETL UPDATE in-place) ---
enviarPedidosCelular       Boolean?              // capital MOVENVPEDI='S' | interior MOVCELACT='S'
reasignacionPuesto         String?  @db.VarChar(2) // capital MOVREASIGN
activarDireccionCalleId    Int?                  // capital MOVCALID (→ catálogo calle)
activarDireccionNro        Int?                  // capital MOVCALNROP
coordActivaX               Decimal? @db.Decimal(13, 5) // capital MOVACTENX (UTM 21S, crudo)
coordActivaY               Decimal? @db.Decimal(13, 5) // capital MOVACTENY (UTM 21S, crudo)
tiempoCumplimientoServicio Int?                  // interior MOVTIEMPOCUMPLSERVICIO
// --- Config NUEVA de goya (editable, vacía hasta cargar) ---
dirSms             String?  @db.VarChar(60)
usaIca             Boolean? @default(false)      // toggle "Ruta ICA" (inicial: existe fila en movil_ica)
mostrarEnMapa      Boolean? @default(true)
actualizarCoord30s Boolean? @default(true)
radioMinIcaMetros  Int?
finalizacionRutas1 Int?
finalizacionRutas2 Int?
activarPorApp      Boolean?
capturaPantalla    Boolean?
grabarPantalla     Boolean?
debugDelivery      Boolean?
puntosRecarga      MovilPuntoRecarga[]
```
Ya existen y se reusan: `descripcion, marca, modelo, matricula, telefono, capacidadLote, servicioPrincipal/tipoServicio, observaciones, estadoCodigo, pedidosPendientes, fleteraId, activoDesde, activoHasta, rutea (usado por ruteo), tieneGps, gpsReportando, appPuedeDesactivar, permiteBajaMomentanea, distanciaMaxMetros, latitud, longitud, destinoId`.

Tabla nueva:
```prisma
model MovilPuntoRecarga {
  id      Int     @id @default(autoincrement())
  movilId Int
  origen  String  @db.VarChar(10)
  puntoId Int?                          // id en V_PTOSRECARGA (backfill futuro)
  nombre  String? @db.VarChar(60)
  movil Movil @relation(fields: [movilId], references: [id], onDelete: Cascade)
  @@index([movilId])
  @@map("movil_punto_recarga")
}
```

## ETL de extensión (`backend/prisma/etl_moviles_config.py`, NUEVO)

**CRÍTICO: UPDATE in-place, NO delete+insert** (un DELETE de `movil` borraría en cascada zonas/servicios/bodega/stock/etc.). El script hace `UPDATE movil SET ... WHERE origen=? AND "idOriginal"=?` por cada móvil.
- Capital `GXCALDTA.MOVILES`: `enviarPedidosCelular`=(MOVENVPEDI='S'), `reasignacionPuesto`=MOVREASIGN, `activarDireccionCalleId`=MOVCALID, `activarDireccionNro`=MOVCALNROP, `coordActivaX`=MOVACTENX, `coordActivaY`=MOVACTENY.
- Interior `PUESTOS.MOVILES`: `enviarPedidosCelular`=(MOVCELACT='S'), `tiempoCumplimientoServicio`=MOVTIEMPOCUMPLSERVICIO.
- `usaIca` inicial: `UPDATE movil SET "usaIca"=true WHERE id IN (SELECT DISTINCT "movilId" FROM movil_ica)`.
- Los campos nuevos de goya (dirSms, mostrarEnMapa, etc.) NO se tocan (quedan en su default).

## Backend — extender módulo `moviles`

- **`GET /moviles/:id`** (extender): devolver TODOS los campos editables + `activarDireccionCalleNombre` (join catálogo `calle` por `activarDireccionCalleId`) + sub-dominios: `productos` (movil_stock), `puntosRecarga` (movil_punto_recarga), `servicios` (movil_servicio + nombre vía servicio), `escenarios` (movil_zona), `bodega` (movil_bodega). `historico: []`.
- **`PATCH /moviles/:id`** — actualiza campos de Datos generales + Ruteo/comportamiento + Operación en app. DTO `UpdateMovilDto` (todos opcionales, class-validator). Sella nada por ahora (no hay operador en movil).
- **Sub-recursos CRUD** (POST/PATCH/DELETE):
  - `/moviles/:id/productos` → `movil_stock` (productoEmpresa, productoCodigo, stockMin=stockMovil, stockDps=stockOcupado, tiempoCarga, tiempoDescarga).
  - `/moviles/:id/puntos` → `movil_punto_recarga` (nombre, puntoId).
  - `/moviles/:id/servicios` → `movil_servicio` (servicioId).
  - `/moviles/:id/escenarios` → `movil_zona` (escenarioId, canalId, zonaId, tipo).
- **`POST /moviles/:id/duplicar`** — crea un móvil nuevo copiando config + sub-dominios (sin matrícula/idOriginal; origen='capital', idOriginal=nuevo id placeholder como en clientes). (Opcional fase 2 si complejiza; si no, el botón abre TODO.)
- **Catálogos** (extender `/moviles/filtros` o nuevo `/moviles/catalogos`): `calles` (id, nombre desde `calle`) para el select de "activar por dirección"; estados/servicios/fleteras ya existen.
- Estado: `PATCH /moviles/:id` con `estadoCodigo` cubre "Desactivar".

## Frontend — `/dashboard/moviles/[id]`

Ruta nueva `src/app/dashboard/moviles/[id]/page.tsx` + componente `MovilDetalle`. Desde la lista, "Configurar"/"Editar"/fila navega acá.
- **Encabezado:** breadcrumb "Inicio / Logística / Móviles / {id}"; título "Móvil {numero} · {matricula}"; subtítulo; botones Volver / **Guardar cambios** (primario) / Duplicar configuración.
- **Columna izq (≈280px, fija):** card "Resumen del móvil" (id grande, matrícula badge, fletera, estado badge, servicio badge, cap. bodega/lote, teléfono, pedidos pendientes, últ. actualización) + botones Ver historial / Ver bodega / Desactivar (danger).
- **Tabs:** Configuración (completa), Historial, Servicios, Bodega, Actividad (las últimas 4 con estado vacío/placeholder real-ready).
- **Tab Configuración — 7 secciones** (ver prompt para campos exactos):
  1. **Datos generales** (form grid): descripción, móvil(readonly), matrícula, fletera(select), marca, modelo, servicio(select), cap. bodega, observaciones(textarea), estado(select), # ped pendientes, teléfono, dir SMS, en-riogas-desde/hasta(date).
  2. **Ruteo y comportamiento**: switches (usado por ruteo=`rutea`, enviar al cel=`enviarPedidosCelular`, actualizar coord 30s=`actualizarCoord30s`, ruta ICA=`usaIca`, mostrar en mapa=`mostrarEnMapa`); reasignación(select=`reasignacionPuesto`); activar por dirección (Nº=`activarDireccionNro` + Calle select=`activarDireccionCalleId` + Esquina[solo visual]); coord activa X/Y(`coordActivaX/Y`); tiempo cumplimiento(`tiempoCumplimientoServicio`); finalización rutas(`finalizacionRutas1/2`); radio mín ICA(`radioMinIcaMetros`).
  3. **Operación en app**: switches (activar por app=`activarPorApp`, desactivar por app=`appPuedeDesactivar`, captura pantalla=`capturaPantalla`); selects (grabar pantalla=`grabarPantalla`, debug=`debugDelivery`, baja momentánea=`permiteBajaMomentanea`); distancia máx=`distanciaMaxMetros`.
  4. **Recarga y productos** (tabla CRUD → `movil_stock`): Empresa/Prod, Cod.Prod, Nom.Prod(=código, sin catálogo), Stock min, Stock dps, T.carga, T.descarga + Agregar/Editar/Eliminar.
  5. **Ptos de recarga** (tabla CRUD → `movil_punto_recarga`): Id, Nombre + Agregar/Editar/Eliminar.
  6. **Servicios habilitados** (tabla CRUD → `movil_servicio`): Servicio(código), Nombre, Acciones.
  7. **Escenarios y prioridad** (tabla CRUD → `movil_zona`): Escenario, Canal, Zona, Prioridad(1), Tránsito(2), Acciones.
  Distribución: 1+2 en 2 columnas desktop; 3 full width; 4 full width; 5/6/7 en 3 columnas.
- **Service/tipos:** extender `src/services/moviles.ts` + `src/lib/types/movil.ts` con detalle completo + mutaciones (update móvil, CRUD sub-recursos). Switches azules ON / gris OFF. Inputs readonly atenuados.
- "Guardar cambios" → `PATCH /moviles/:id` (un solo guardado de las secciones 1-3); las tablas 4-7 guardan por fila (sub-recurso) al agregar/editar/eliminar. "Desactivar" → modal confirm → PATCH estado. "Duplicar" → POST duplicar o TODO.

## Fuera de alcance
Tabs Historial/Actividad con datos (movil_historico vacío) → placeholders real-ready. Catálogo de productos (Nom.Prod real). Backfill de V_PTOSRECARGA. Sync AS400. Sidebar global (Logística submenús).

## Testing
Backend `npm run build` ✅; `prisma db push` aplica la extensión sin tocar datos existentes; etl_moviles_config UPDATE no reduce counts de sub-dominios. Front `npm run build` ✅. Golden path: abrir un móvil → editar datos generales + toggles → Guardar → recargar y ver persistido; agregar/eliminar un producto/servicio/escenario.
