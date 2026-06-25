# Pantalla Administración de Móviles (/dashboard/moviles) — Diseño

**Fecha:** 2026-06-25
**Estado:** Aprobado (datos reales) — pendiente implementar
**Relacionados:** `2026-06-24-merge-moviles-fleteras-design.md` (modelo de datos), módulo clientes (mismo patrón back/front).

## Objetivo

Construir la pantalla principal de administración de móviles/flota en `/dashboard/moviles`, cableada a los **datos reales** del modelo unificado (516 móviles). Backend: nuevo módulo NestJS `moviles` (lista con filtros + KPIs + detalle + catálogos de filtro). Frontend: la pantalla descrita en el prompt del usuario (KPIs, filtros, tabla, panel de detalle lateral, histórico), estética dark corporativa.

## Decisiones

1. **Datos reales** (no mock). Se cablea a las tablas `movil` / `empresa_fletera` / `movil_estado` / `servicio` / `movil_ica`.
2. **Reusar el layout actual de goya** (Sidebar/Navbar existentes). Se construye solo el **contenido** de la página con la estética del prompt. NO se rehace el sidebar/header.
3. **Stub (no hay datos):** los deltas "% vs semana pasada" de los KPIs y el **timeline de histórico de estados** (`movil_historico` está vacío por diseño). El panel muestra estado vacío elegante ("Sin histórico registrado").

## Tokens de estilo (del prompt)

Fondo `#08111F`; sidebar/header `#0B1526`; cards `#0F1B2D` borde `#1E2B44`; radius 14-16px. Texto `#E6EEF8` / secundario `#94A3B8`. Azul `#2563EB` (hover `#1D4ED8`); cyan `#06B6D4`; verde `#22C55E`; rojo `#EF4444`; naranja `#F97316`; violeta URG `#8B5CF6`. shadcn/ui + lucide-react. Todo en español. (Respetar el theme dark existente de goya; estos tokens guían los acentos.)

## Backend — módulo `moviles` (NestJS, `backend/src/moviles/`)

Mismo patrón que `clientes`: `@UseGuards(AuthGuard)`, prefijo global `/api`.

### Resolución de catálogos en memoria
`movil_estado` (12) y `servicio` (61) NO son relaciones Prisma (join lógico por `origen`+código). El service carga ambos en un Map al consultar y adjunta `estadoNombre` / `servicioNombre`. `empresa_fletera` SÍ es relación (`movil.fletera`).

### Endpoints
- **`GET /moviles`** — lista paginada. Query: `search` (matricula / idOriginal / numeroMovil), `estadoCodigo`, `tipoServicio`, `fleteraId`, `rutaIca` (`si`|`no` → existe/no fila en `movil_ica`), `origen`, `page`, `pageSize`, `sort` (`movil`|`-movil`…). Respuesta `{ data: MovilListItem[], total, page, pageSize }`.
  - `MovilListItem`: `id`, `numero`(=idOriginal o numeroMovil), `matricula`, `fleteraNombre`(movil.fletera.nombre), `estadoCodigo`, `estadoNombre`, `tipoServicio`/`servicioPrincipal`, `pedidosPendientes`(#Pend), `capacidadLote`(#Lote), `ok`(=rutea? 'S'/'N'), `tieneGps`(GPS), `observaciones`, `ultimaActualizacion`(ultimaPosicionAt ?? updatedAt), `origen`.
- **`GET /moviles/kpis`** — `{ total, activosEnViaje, enEspera, sinGps }`. Cálculo: `total`=count; `activosEnViaje`=count estados cuyo nombre contiene "VIAJE"; `enEspera`=nombre contiene "ESPERA" (sin "RECARGA") — o agrupar según `movil_estado`; `sinGps`=count `tieneGps` false/null. (Sin deltas %.)
- **`GET /moviles/:id`** — detalle: campos de `movil` + `fleteraNombre`, `estadoNombre`, `servicioNombre`, `latitud/longitud`, `telefono`, `capacidadLote`, `pedidosPendientes`, `destino` (movil_destino.nombre), y `historico: []` (vacío; estructura lista para cuando se cargue).
- **`GET /moviles/filtros`** — catálogos para los selects: `{ estados:[{codigo,nombre}], servicios:[string], fleteras:[{id,nombre}] }` (estados desde `movil_estado` distinct por nombre; servicios desde distinct `movil.tipoServicio`/`servicioPrincipal`; fleteras desde `empresa_fletera`).

### DTO/validación
`QueryMovilesDto` (class-validator, todos opcionales salvo paginación con defaults). Sin escritura en esta fase (la pantalla es de consulta + navegación; "Nuevo móvil"/"Modificar lote"/"Editar" navegan o abren modales que se cablean en una fase posterior — por ahora los botones existen y rutean/abren modal con TODO).

### Módulo
`MovilesModule` (controller+service) registrado en `app.module.ts`.

## Frontend

### Service + tipos
- `src/lib/types/movil.ts`: `Movil`, `MovilListItem`, `MovilKpis`, `MovilFiltros`, `QueryMovilesParams`, helpers `estadoBadge(codigo|nombre)` (color+label) y `servicioBadge`.
- `src/services/moviles.ts`: `getMoviles(params)`, `getMovilKpis()`, `getMovil(id)`, `getMovilFiltros()` (axios, mismo proxy `/api` → NestJS).

### Pantalla `/dashboard/moviles`
Reemplaza el placeholder mock actual (`src/components/dashboard/moviles/Moviles.tsx`). Estructura:
1. **Breadcrumb** "Inicio / Logística / Móviles" + título "Administración de móviles" + subtítulo. A la derecha: botones **Nuevo móvil** (primario), **Configuración Obelix**, **Ver bodega**, **Exportar Excel**. (Acciones: Nuevo/Obelix/Bodega → rutean o modal TODO; Exportar → CSV/Excel del set filtrado.)
2. **Fila de KPIs** (4 cards) desde `/moviles/kpis`: Total móviles, Activos en viaje, En espera, Sin GPS. Iconos/colores del prompt. Los deltas % se muestran como guion "—" o se omiten (stub; no hay histórico).
3. **Card de filtros**: buscar + selects (Estado, Servicio, Empresa fletera, Ruta ICA) desde `/moviles/filtros`; botones Aplicar/Limpiar; segunda fila "Modificar lote" / "Histórico" (modal TODO).
4. **Tabla** (Card): columnas exactas del prompt (Sel, Móvil [sortable], Matrícula, Empresa fletera, Estado [badge], Servicio [badge], #Pend, #Lote [badge], OK?, GPS [badge], Observaciones, Últ. actualización, Acciones). Filas hover + seleccionable; al seleccionar actualiza el panel lateral. Acciones por fila: Editar (Pencil), Configurar (Cog), Historial (History), Más (MoreVertical) con tooltips.
5. **Panel lateral derecho** "Móvil seleccionado": número grande, matrícula, fletera, estado, servicio, cap. bodega 13kg, pedidos pendientes, #lote, GPS, teléfono, últ. actualización. Debajo "Histórico de estados" (timeline) → **estado vacío** "Sin histórico registrado" + botón "Ver historial completo" (deshabilitado/TODO).
6. **Footer de tabla**: "Mostrando X a Y de N", filas por página, paginación.

Estado de selección + filtros en URL (nuqs) como en clientes. Paginación + (opcional) virtualización.

### Badges (mapeo)
- Estado: nombre contiene "VIAJE"→verde; "ESPERA"+"RECARGA"→cyan; "ESPERA"→naranja; "INACTIVO"/"NO ACTIVO"/"NO TRABAJA"→rojo; default gris.
- Servicio: "URG"→violeta; "SERVI"→azul; otro→gris.
- OK? "S"→verde; GPS "Con GPS"→verde+Signal / "Sin GPS"→rojo+SignalOff. #Lote→badge azul.

## Mapeo a campos reales (Prisma `movil`)
`numero`=`idOriginal` (o `numeroMovil` si no nulo) · `matricula`=`matricula` · fletera=`fletera.nombre` · estado=`movil_estado[origen,estadoCodigo].nombre` · servicio=`tipoServicio` (fallback `servicioPrincipal`) · #Pend=`pedidosPendientes` · #Lote=`capacidadLote` · OK?=`rutea?'S':'N'` · GPS=`tieneGps` · obs=`observaciones` · últ.act=`ultimaPosicionAt ?? updatedAt` · tel=`telefono` · cap.bodega=`capacidadLote` (no hay campo "bodega 13kg" separado salvo `movil_bodega`; usar `capacidadLote` o sumar `movil_bodega.capacidad`).

## Fuera de alcance (fase posterior)
Alta/edición de móvil (write), modal Modificar lote, Configuración Obelix/ICA, modal Histórico completo (necesita poblar `movil_historico`), export real a .xlsx (por ahora CSV). Ajuste del sidebar global (Logística → submenús).

## Testing
Backend: `npm run build` verde; endpoints devuelven datos reales (list/kpis/detalle/filtros) con el token secapi. Front: `npm run build` verde; golden path: abrir /dashboard/moviles → KPIs con números reales → filtrar por estado/fletera/servicio → seleccionar fila → panel lateral con datos reales del móvil.
