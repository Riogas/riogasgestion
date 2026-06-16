# Diseño — Reconstrucción del módulo de Clientes y la Ficha del Cliente

**Proyecto:** Goya / RioGas Gestión (`riogasgestion`)
**Fecha:** 2026-06-16
**Stack:** Next.js 16 (App Router) + NestJS 11 (PostgreSQL/TypeORM)
**Estado:** Diseño aprobado, pendiente de plan de implementación

---

## 1. Contexto y problema

La ficha del cliente es la pantalla casi principal del sistema y la que se quiere potenciar.
Hoy **no es funcional**: las tres rutas (`/clientes`, `/clientes/nuevo`, `/clientes/[id]`)
colapsan en un único `ClienteForm` (732 líneas) que:

- No carga el cliente por `id` (la prop `clienteId` se recibe y se ignora).
- Tiene los inputs de la pestaña "Datos" **sin estado** (placeholders, sin `value`/`onChange`).
- El botón "Guardar" solo prende un spinner infinito; no persiste nada.
- No existe capa de datos de cliente: ni endpoints, ni servicio, ni hooks, ni tipos.
  El `ClientesModule` del backend está comentado.
- ~40% del archivo es código muerto (un `Modal` sin uso, ~15 `useState` huérfanos,
  un tour Joyride que nunca se dispara, `mockStreets`, departamentos hardcodeados).
- Bugs concretos: "Apto" y "Local" escriben sobre el mismo campo; "Tipo Cliente" duplicado;
  `console.log [ZONA DEBUG]`; toasts con `duration: Infinity`.

Lo único aprovechable a nivel UI son `TelefonosTable` (CRUD local de teléfonos) y
`DireccionEditor` (dirección con mapa Leaflet + validación de zona), aunque tampoco persisten.

**En resumen: no es "mejorar" una ficha, es construir el módulo de clientes desde la capa de datos.**

## 2. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Backend de datos | **NestJS propio** (Postgres + TypeORM + CRUD). Independiente del legacy GeneXus. |
| Datos existentes | **Importar el padrón una vez** desde el legacy/AS400; luego Goya es la fuente de verdad. |
| Alcance | **Módulo de clientes completo**: lista real + alta + ficha (ver/editar). |
| Layout de la ficha | **"Command Center"** (cabecera viva + resumen lateral + tabs animadas + edición inline). |
| Estilo visual | Data-Dense Dashboard. Azul `#2563EB` + verde `#059669` + colores de estado. Numeración tabular. Dark mode nativo. |
| Alta | **Dual**: slide-over rápido por defecto + link a wizard guiado en pasos. |

## 3. Objetivos y criterios de éxito

- Abrir `/clientes/[id]` carga y muestra el cliente real (datos + teléfonos + direcciones).
- Editar un campo guarda (autosave optimista) y persiste en Postgres.
- Crear un cliente desde la lista en ~15 s vía slide-over, con dirección autocompletada,
  pin automático y validación de zona en vivo.
- La lista de clientes es real, paginada y buscada **server-side** (la cartera no entra en memoria).
- Las tabs Pedidos/Servicios/Cuenta existen como placeholders coherentes ("próximamente").
- Cero código muerto del `ClienteForm` anterior.
- Todos los endpoints nuevos pasan por un auth guard.

## 4. Fuera de alcance / dependencias

- **Import del padrón**: depende de la fuente legacy/AS400 (el API AS400 sigue pendiente).
  Se diseña el comando de importación pero su ejecución real es una tarea aparte (Fase 6).
- **Datos reales de Pedidos / Servicios / Cuenta**: esos módulos hoy son mock. Sus tabs van como
  placeholder hasta que tengan backend real.
- **Hallazgos de seguridad globales** (TLS deshabilitado en el proxy, token en cookie no-HttpOnly,
  backdoor mock, `ignoreBuildErrors`): son un esfuerzo separado. Aquí solo se garantiza que los
  endpoints nuevos lleven auth guard.

---

## 5. Modelo de datos (PostgreSQL / TypeORM)

### `clientes`
| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `nro_cliente` | int, unique nullable | número del sistema legacy |
| `nombre` | varchar | requerido |
| `apellido` | varchar nullable | |
| `tipo_cliente` | enum `DOMESTICO`/`COMERCIAL` | |
| `categoria` | enum `RESIDENCIAL`/`COMERCIAL`/`INDUSTRIAL` nullable | |
| `rut_ci` | varchar nullable | RUT o CI |
| `gci` | varchar nullable | GCI Nº |
| `email` | varchar nullable | |
| `privilegio` | varchar nullable | |
| `obs_cliente` | text nullable | |
| `obs_general` | text nullable | |
| `obs_comercial` | text nullable | |
| `estado` | enum `ACTIVO`/`INACTIVO`/`PENDIENTE` | baja lógica |
| `fecha_alta` | timestamptz | |
| `fecha_ult_modif` | timestamptz | |
| `fecha_ult_compra` | timestamptz nullable | |
| `created_at` / `updated_at` | timestamptz | |

### `cliente_telefonos` (N → cliente)
`id` uuid PK · `cliente_id` FK · `numero` · `alias` · `tipo` · `estado` · `es_principal` bool

### `cliente_direcciones` (N → cliente)
`id` uuid PK · `cliente_id` FK · `calle` · `nro_puerta` · `esquina1` · `esquina2` ·
`apto` · `local` (campos **separados**, corrige el bug actual) · `departamento_id` ·
`localidad_id` · `zona` · `lat` · `lng` · `nivel` · `es_principal` bool · `en_zona` bool (cache)

> Restricción: a lo sumo un teléfono y una dirección con `es_principal = true` por cliente.

## 6. API NestJS (`/api`, con auth guard global)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/clientes` | Lista paginada server-side (`search`, `page`, `pageSize`, filtros estado/tipo) |
| GET | `/clientes/:id` | Ficha completa (cliente + teléfonos + direcciones) |
| POST | `/clientes` | Alta (DTO validado) |
| PATCH | `/clientes/:id` | Update parcial (autosave) |
| DELETE | `/clientes/:id` | Baja lógica (estado → INACTIVO) |
| POST/PATCH/DELETE | `/clientes/:id/telefonos[/:telId]` | ABM de teléfonos |
| POST/PATCH/DELETE | `/clientes/:id/direcciones[/:dirId]` | ABM de direcciones |
| GET | `/direcciones/autocompletar?q` | Sugerencias de calle desde el padrón de calles |
| GET | `/direcciones/validar-zona?lat&lng` | Reutiliza la lógica turf + capas (in/out zona) |
| GET | `/clientes/:id/pedidos` `/servicios` `/cuenta` | Placeholders (501/empty) hasta que existan datos reales |

- DTOs validados con `class-validator`; el contrato se refleja en schemas `zod` del frontend
  (fuente de verdad compartida del shape).
- Errores: no filtrar `Error.message` interno al cliente; respuesta de error genérica + código.

## 7. Arquitectura frontend

### Capa de datos
- `src/lib/types/cliente.ts` — tipos TS + schemas `zod` (compartidos con la validación de formularios).
- `src/services/clientes.ts` — funciones API tipadas (sobre el axios `/api` existente).
- `src/hooks/clientes/` — hooks TanStack Query:
  `useClientes` (lista), `useCliente(id)`, `useCreateCliente`, `useUpdateCliente`,
  `useTelefonosMutation`, `useDireccionesMutation` (con optimistic update + invalidación).

### Componentes (`src/components/clientes/`)
- `ClienteHeader` — hero sticky: avatar/iniciales, nombre, #cliente, badges (estado, zona persistente,
  tipo), KPIs (saldo / último pedido / #direcciones), acción primaria (+ Pedido), menú `⋯`.
- `ClienteResumen` — rail lateral colapsable: contacto rápido (llamar/WhatsApp), mini-mapa de la
  dirección principal, dato maestro (RUT/GCI/alta).
- `ClienteTabs` — navegación de tabs sincronizada con la URL vía `nuqs` (deep-linkable), con contadores.
- Tabs: `DatosTab`, `DireccionesTab`, `TelefonosTab`, `PedidosTab`, `ServiciosTab`, `CuentaTab`.
- `AddressPicker` — **componente reutilizable**: autocompletar calle + mapa Leaflet + pin automático +
  validación de zona en vivo. Reemplaza la lógica duplicada entre `ClienteForm` y `DireccionEditor`.
- `AltaSlideOver` (vaul) — alta rápida de una pantalla (esencial + dirección + "Más datos" opcional).
- `AltaWizard` — alta guiada en pasos (Datos → Dirección → Confirmar) con barra de progreso.
- `ClienteCommandMenu` (cmdk) — paleta ⌘K contextual al cliente.
- `ClientesList` — lista real con paginación server-side + `@tanstack/react-virtual`.

### Helpers
- `src/lib/geo/` — helpers GeoJSON y validación de zona extraídos (hoy duplicados/inline en componentes).

### Reemplazo
- Se elimina `ClienteForm.tsx` (732 líneas) y su código muerto. La ruta `[id]` pasa a componer
  `ClienteHeader` + `ClienteResumen` + `ClienteTabs`. `/nuevo` ya no es página propia; el alta es
  el slide-over (con fallback a página si se entra por URL directa).

## 8. Librerías nuevas

| Librería | Para qué |
|---|---|
| `@tanstack/react-query` | Fetching/caché/optimistic updates/invalidación contra NestJS |
| `react-hook-form` + `zod` + `@hookform/resolvers` | Formularios controlados con validación por schema |
| `nuqs` | Estado de UI en la URL (tab activo, filtros de lista) → deep-linking |
| `@tanstack/react-virtual` | Virtualización de listas largas (padrón, pedidos, servicios) |
| `vaul` | Slide-over / sheet accesible para el alta rápida |

Ya presentes y reutilizadas: `@tanstack/react-table`, `framer-motion`, `sonner`, `cmdk`,
`react-leaflet` / `leaflet`, `@turf/*`.

## 9. UX / Calidad (de la inteligencia de diseño)

- **Accesibilidad**: labels asociados (`htmlFor`/`id`), contraste ≥ 4.5:1, focus rings visibles,
  `aria-label` en botones icon-only, `aria-live` en toasts y en el indicador de guardado.
- **Formularios**: validación inline **on blur** (no en cada tecla), error debajo del campo,
  autosave de borrador, indicadores de requerido, progressive disclosure en el alta.
- **Animación**: transiciones 150–300ms, `transform`/`opacity`, respetar `prefers-reduced-motion`,
  cabecera que colapsa con continuidad espacial.
- **Performance**: `next/dynamic` para el mapa (`ssr:false`) y componentes pesados, Suspense +
  skeletons, virtualización de listas, sin layout shift.
- **Estado de zona**: indicador **persistente** en la cabecera (no un toast efímero como hoy).

## 10. Testing

- **Backend**: unit tests del `ClientesService` y validación de DTOs.
- **Frontend / e2e (Playwright, ya configurado)**:
  1. Abrir ficha de un cliente → muestra datos + teléfonos + direcciones.
  2. Editar un campo → autosave → recargar → persiste.
  3. Alta vía slide-over → cliente creado → aterriza en la ficha.
  4. Dirección fuera de zona → indicador ⚠ correcto.

## 11. Fases de implementación

1. **Backend clientes**: entidades + migración + CRUD + DTOs + auth guard. (descomenta `ClientesModule`)
2. **Capa de datos frontend**: TanStack Query provider + tipos/zod + `services/clientes.ts` + hooks.
3. **Ficha Command Center**: `ClienteHeader` + `ClienteResumen` + tabs Datos/Teléfonos/Direcciones +
   `AddressPicker` + edición inline con autosave. Elimina `ClienteForm`.
4. **Lista + alta**: `ClientesList` server-side + virtualizada; `AltaSlideOver` + `AltaWizard`.
5. **Tabs Pedidos/Servicios/Cuenta**: placeholders coherentes (consumen endpoints stub).
6. **Import del padrón**: comando de migración legacy/AS400 → Postgres (depende de fuente).

## 12. Riesgos

- **Duplicación de dato maestro** con el legacy: al elegir NestJS propio + import único, si el legacy
  sigue editando clientes, habrá divergencia. Mitigación: definir a Goya como fuente de verdad post-import
  o, si se requiere convivencia, escalar a sincronización (decisión diferida).
- **Fuente del padrón** (AS400) no resuelta: bloquea la Fase 6, no las Fases 1–5.
- **Lógica de zona** acoplada a capas GeoJSON: extraerla a `lib/geo/` con cuidado para no romper
  `zonificacion`/`zonas` que comparten conceptos.
