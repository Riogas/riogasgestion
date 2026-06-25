# Pantalla Empresas Fleteras (/dashboard/empresafletera) — Diseño

**Fecha:** 2026-06-25
**Estado:** Aprobado (datos reales) — pendiente implementar
**Relacionados:** `2026-06-25-front-moviles-admin-design.md` (mismo patrón lista), `2026-06-24-merge-moviles-fleteras-design.md` (modelo).

## Objetivo
Pantalla de administración de empresas fleteras (`/dashboard/empresafletera`), datos REALES sobre `empresa_fletera` (222). Lista + filtros + KPIs + panel lateral de detalle (empresa + móviles + zonas). Read-only en esta fase; alta/edición navegan a un detalle futuro. Estética dark corporativa del prompt; reusar layout de goya.

## Datos (verificados 2026-06-25)
- `empresa_fletera` = **222** (estado A=105, P=117). `puestoId` distintos = **14**. Móviles con fletera = **515** (1 huérfano).
- Catálogo `puesto` (id→nombre: 2 MALDONADO, 4 SALTO, 5 TACUAREMBO…). Catálogo `zona` = 280 (nombre + puestoId).
- `empresa_fletera`: id, idOriginal, origen, puestoId, nombre, telefono, direccion(=Calle), baseOperativa(capital), estado(A/P), ruc, email, observaciones.

## Backend — módulo NestJS `fleteras` (nuevo, `backend/src/fleteras/`)
Mismo patrón que `moviles`. `@UseGuards(AuthGuard)`, prefijo `/api`. "Móvil activo" = estado cuyo nombre empieza con "ACTIVO" (mismo criterio que la lista de móviles; calcular pares (origen,codigo) activos desde `movil_estado`).

- **`GET /fleteras`** (paginado): filtros `search`(nombre, contains insensitive), `estado`(A/P/I), `puestoId`, `conMoviles`(`con-activos`|`sin-activos`|`sin`). Para `cantMoviles`/`activos` por fila: una `movil.groupBy({by:['fleteraId'], _count})` para el total + otra agregación para activos (where estadoCodigo IN activos por origen), mapear por fleteraId (evitar N+1). Incluir `puestoNombre` (join catálogo `puesto`). Respuesta `{data: FleteraListItem[], total, page, pageSize}`.
  - `FleteraListItem`: id, idOriginal, puestoId, puestoNombre, nombre, telefono, calle(=direccion), estado, cantMoviles, activos, ultimaFecha(=updatedAt), origen.
  - Filtro `conMoviles`: `con-activos` → tiene ≥1 móvil activo; `sin-activos` → tiene móviles pero 0 activos; `sin` → 0 móviles. (Implementar con `moviles: { some/none }` + el set de estados activos.)
- **`GET /fleteras/kpis`**: `{ total, activas (estado='A'), movilesAsociados (count movil con fletera), puestosCubiertos (distinct puestoId) }`. Sin deltas %.
- **`GET /fleteras/filtros`**: `{ estados:[{value,label}] (A=Activo,P=Pasivo,I=Inactivo), puestos:[{id,nombre}] (de los puestos usados por fleteras) }`.
- **`GET /fleteras/:id`**: detalle para el panel: campos de la empresa + `puestoNombre` + `movilesActivos`/`movilesNoActivos` (counts) + `moviles` (lista compacta: id/numero, descripcion/conductor=`descripcion`, estado activo?) + `zonas` (del puesto: `zona` where puestoId=empresa.puestoId, devolver nombre) + `pedidosPendientes: null` (stub, no hay módulo pedidos).

## Frontend — `/dashboard/empresafletera`
Reemplaza el placeholder actual (hay `configuracion/Fleteras.tsx` mock; la ruta real del menú es `/dashboard/empresafletera`). Crear `src/app/dashboard/empresafletera/page.tsx` + `EmpresasFleteras.tsx`. Reusar layout de goya. shadcn/ui + lucide-react. Español.
- **Encabezado:** breadcrumb "Inicio / Logística / Empresas fleteras"; título + subtítulo; botones Nueva empresa(primario) / Ver móviles / Ver zonas / Exportar Excel (CSV). Nueva/Editar/Ver-detalle → navegan a TODO (detalle futuro); Ver móviles → `/dashboard/moviles?fletera=:id`; Ver zonas → TODO.
- **KPIs (4):** Total empresas, Empresas activas, Móviles asociados, Puestos cubiertos (de `/fleteras/kpis`). Deltas % → "—" (stub).
- **Filtros:** search empresa, Estado, Puesto (de `/fleteras/filtros`), Con móviles; Aplicar/Limpiar. (Default "Todos" — 222 filas, no hace falta default-activos.)
- **Tabla "Listado de empresas":** columnas Sel, Puesto, Id, Nombre, Teléfono, Calle, Estado(badge A=verde/P=gris/I=rojo), Cant. móviles, # Activos, Últ. fecha, Acciones (Editar/Visualizar/Más con tooltips). Filas hover + seleccionable (actualiza panel). Footer "Mostrando X a Y de N" + filas por página + paginación. URL state (nuqs) como en móviles.
- **Panel lateral derecho:**
  1. **Empresa seleccionada:** ID, nombre, badge estado, puesto, teléfono, calle, móviles activos, móviles no activos, últ. actualización; botones Editar empresa / Ver detalle (→ TODO detalle).
  2. **Móviles de la empresa** (lista compacta: móvil, conductor=`descripcion`, estado badge) + botón "Enviar mensaje al móvil" (TODO).
  3. **Alerta pedidos pendientes:** STUB — ocultar o mostrar estado neutro ("Pedidos: módulo no conectado") ya que no hay datos de pedidos.
  4. **Zonas asociadas:** chips con los nombres de zona del puesto (de `/fleteras/:id`.zonas) + botón "Consultar zonas" (→ TODO).
- **Service/tipos:** `src/services/fleteras.ts` + `src/lib/types/fletera.ts` (list/kpis/filtros/detalle).

## Mapeo a campos reales
puesto=join `puesto.nombre` por puestoId · calle=`direccion` · estado A=Activo/P=Pasivo/I=Inactivo · cantMoviles/#activos=agregación sobre `movil` (activo = estado nombre empieza con "ACTIVO") · últ. fecha=`updatedAt` (no hay un "último ingreso" migrado) · conductor (panel móviles)=`movil.descripcion`.

## Fuera de alcance (fase posterior)
Alta/edición/detalle de empresa (write + pantalla detalle), "Enviar mensaje al móvil", "Consultar zonas", alerta real de pedidos pendientes (no hay módulo pedidos), export .xlsx (por ahora CSV), deltas % de KPIs.

## Testing
Backend `npm run build` ✅; endpoints devuelven datos reales (list con cantMoviles/activos, kpis 222/105/515/14, filtros, detalle con zonas). Front `npm run build` ✅. Golden path: abrir pantalla → KPIs reales → filtrar por estado/puesto/con-móviles → seleccionar fila → panel con empresa + móviles + zonas reales.
