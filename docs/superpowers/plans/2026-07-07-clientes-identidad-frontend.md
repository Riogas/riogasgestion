# Clientes: identidad + workbench + identificación (Frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** UI para la capa de identidad: workbench de deduplicación, vista 360 de Persona (call center) y pantalla de identificación del distribuidor (ficha redactada), sobre el backend ya construido.

**Architecture:** Next.js App Router. Datos vía axios `api` (`@/lib/axios`, baseURL `/api`) + TanStack Query hooks. Tipos espejo en `@/lib/types`. Componentes con Radix + tailwind-variants + lucide + sonner + TanStack Table/Virtual, imitando `src/components/clientes/*`.

**Tech Stack:** Next 15, React, TanStack Query/Table/Virtual, Radix UI, tailwind-variants, react-hook-form + zod, sonner, react-leaflet.

## Global Constraints

- Todo llama al backend por `api` (`@/lib/axios`); NO fetch directo. Endpoints bajo `/api` (catch-all → NestJS).
- Tipos nuevos espejo del backend, en `src/lib/types/persona.ts` (no tocar `cliente.ts` salvo import).
- Hooks TanStack: `params` memoizados (ver advertencia en `useClientes.ts`); invalidar queryKeys tras mutaciones; toasts con `sonner`.
- Estilo/patrón: copiar de `src/components/clientes/*` y `src/components/dashboard/clientes/ClientesList.tsx` (tabla, badges de estado con `estadoLabel`/`estadoVariant` de `@/lib/types/cliente`).
- El operador NO ve rol en el front de identificación: el backend deriva rol/afiliación de `req.user`; el front solo manda `{identificador, tipo}`.
- Verificación: `pnpm build` (o `npm run build`) y `npm run lint` en la raíz. E2E Playwright requiere stack corriendo (backend+DB) → se deja como smoke manual, no bloqueante.

## Backend endpoints (contrato)
- `GET /personas/:id` → `Persona360 { persona, registros, telefonos, direcciones, hogares }`
- `PATCH /personas/:id/canonical` `{ nombreOficial?, cedula?, telefonoPrincipalId?, direccionPrincipalId? }`
- `POST /personas/unify` `{ registroIds:number[] }` → `{ personaId }`
- `POST /personas/split` `{ registroIds:number[] }` → `{ nuevas:number[] }`
- `GET /workbench/sugerencias?tipo&estado&minConfianza&page&pageSize` → `{ data:MatchSugerencia[], total, page, pageSize }`
- `POST /workbench/sugerencias/:id/{aceptar|rechazar|deshacer}`
- `POST /identificacion` `{ identificador, tipo:'CEDULA'|'TELEFONO' }` → `FichaRedactada { nombre, estado?, cedula?, telefono?, direccion?, scope:'MINIMA'|'AFILIADA'|'COMPLETA' }`

---

## Phase F1 — Data layer (tipos + services + hooks)

### Task F1.1: Tipos espejo
**Files:** Create `src/lib/types/persona.ts`
- [ ] Definir interfaces espejo del backend: `Persona` (id, nombreOficial, cedula, rucPrincipal, telefonoPrincipalId, direccionPrincipalId, estado, notasInternas), `Persona360` (persona; registros: Cliente[]; telefonos: ClienteTelefono[]; direcciones: ClienteDireccion[]; hogares: Hogar[]), `Hogar` (id, etiqueta, direccionTextoNorm, lat, lng), `MatchSugerencia` (id, tipo:'DUPLICADO'|'HOGAR', registroA, registroB, personaA, personaB, senal, confianza, estado, operador, resueltoAt, hogarIdResuelto), `FichaRedactada` (nombre, estado?, cedula?, telefono?, direccion?, scope). Reusar `Cliente`/`ClienteTelefono`/`ClienteDireccion` de `./cliente`.
- [ ] Commit.

### Task F1.2: Services
**Files:** Create `src/services/personas.ts`, `src/services/workbench.ts`, `src/services/identificacion.ts`
- [ ] `personas.ts`: `getPersona360(id)`, `setCanonical(id, dto)`, `unify(registroIds)`, `split(registroIds)`.
- [ ] `workbench.ts`: `getSugerencias(params)`, `aceptarSugerencia(id)`, `rechazarSugerencia(id)`, `deshacerSugerencia(id)`.
- [ ] `identificacion.ts`: `identificar({identificador, tipo})`.
- [ ] Todos usan `api` de `@/lib/axios`, tipados con `persona.ts`. Commit.

### Task F1.3: Hooks
**Files:** Create `src/hooks/personas/` (`usePersona.ts`, `usePersonaMutations.ts`), `src/hooks/workbench/` (`useSugerencias.ts`, `useSugerenciaMutations.ts`), `src/hooks/identificacion/useIdentificar.ts`
- [ ] `usePersona(id)` (useQuery), `usePersonaMutations` (setCanonical/unify/split con invalidación de `['persona',id]` y `['clientes']`).
- [ ] `useSugerencias(params)` (memoizar params), `useSugerenciaMutations` (aceptar/rechazar/deshacer → invalida `['sugerencias']`, toasts sonner).
- [ ] `useIdentificar()` (useMutation; NO cachear — es lookup puntual). Commit.

---

## Phase F2 — Workbench de deduplicación

### Task F2.1: Página + tabla de sugerencias
**Files:** Create `src/app/dashboard/clientes/workbench/page.tsx`, `src/components/clientes/workbench/SugerenciasTable.tsx`, `src/components/clientes/workbench/WorkbenchFilters.tsx`
- [ ] Página con filtros (tipo DUPLICADO/HOGAR, estado, minConfianza) → `useSugerencias`. Tabla (TanStack Table) con columnas: tipo, señal (badge), confianza (barra/porcentaje), estado, y acciones. Paginación. Vacío/loole skeleton al estilo `ClientesList`.
- [ ] Fila DUPLICADO muestra registroA vs registroB (nombre); HOGAR muestra personaA vs personaB. Commit.

### Task F2.2: Modal de comparación + acciones
**Files:** Create `src/components/clientes/workbench/CompararModal.tsx`; modify `SugerenciasTable.tsx`
- [ ] Modal (Radix Dialog) que al abrir una sugerencia DUPLICADO carga ambos registros (`getCliente`) y los muestra **lado a lado** (nombre, ruc, cédula, tel principal, dirección principal), resaltando coincidencias. Para HOGAR carga ambas personas (`getPersona360`) y muestra sus direcciones.
- [ ] Botones: **Unificar/Confirmar hogar** (`aceptar`), **Rechazar**, y para resueltas **Deshacer**. Toasts + cierre + invalidación. Commit.

---

## Phase F3 — Vista 360 Persona (call center)

### Task F3.1: Página 360 + resumen
**Files:** Create `src/app/dashboard/clientes/persona/[id]/page.tsx`, `src/components/clientes/persona/Persona360.tsx`, `src/components/clientes/persona/RegistrosVinculados.tsx`
- [ ] `usePersona(id)` → cabecera (nombreOficial, cédula, estado badge), sección **registros vinculados** (los `cliente_uni` crudos que componen la persona), y agregados de **teléfonos** y **direcciones** (reusar `TelefonosTable`/`DireccionesTable` si encaja, o tablas simples). Sección **hogares** (etiqueta + miembros).
- [ ] Botón **Separar registro** (`split`) por registro vinculado. Commit.

### Task F3.2: Editar datos canónicos
**Files:** Create `src/components/clientes/persona/CanonicalEditor.tsx`
- [ ] Form (react-hook-form + zod) para `nombreOficial`, `cedula`, y selects de `telefonoPrincipalId`/`direccionPrincipalId` (opciones = los tel/dir agregados). `setCanonical` con toast + invalidación. Maneja error 409 (cédula duplicada) mostrando mensaje claro. Commit.

---

## Phase F4 — Identificación del distribuidor

### Task F4.1: Pantalla de identificación
**Files:** Create `src/app/dashboard/identificacion/page.tsx`, `src/components/identificacion/IdentificarForm.tsx`, `src/components/identificacion/FichaRedactadaView.tsx`
- [ ] Form: selector tipo (CÉDULA/TELÉFONO) + input identificador + botón Identificar → `useIdentificar`. Solo manda `{identificador, tipo}`.
- [ ] Render de los **3 desenlaces**: `SIN_MATCH` → CTA "Alta de cliente nuevo"; `MATCH` con `requiereAltaDireccion` → muestra nombre + aviso "dar de alta dirección de tu zona"; `MATCH` normal → `FichaRedactadaView` según `scope` (MINIMA = solo nombre; AFILIADA = nombre/estado/cédula/último tel/última dir; COMPLETA para call center).
- [ ] `FichaRedactadaView` NO asume campos presentes (todos opcionales según scope). Commit.

---

## Phase F5 — Navegación + verificación

### Task F5.1: Enlaces de navegación
**Files:** Modify el menú/dashboard donde corresponda (buscar dónde se listan las secciones de clientes, p.ej. `src/components/clientes/ClienteCommandMenu.tsx` o el sidebar del dashboard)
- [ ] Agregar acceso a **Workbench** desde la lista de clientes y a **Identificación** desde el dashboard. Commit.

### Task F5.2: Build + lint
- [ ] `npm run build` → sin errores de tipo. `npm run lint` → sin errores nuevos. Commit si hubo ajustes.
- [ ] (Manual, no bloqueante) smoke Playwright con el stack corriendo.

## Self-Review
- Workbench (spec §7 workbench) → F2. Vista 360 (spec §1/§6 call center) → F3. Identificación 3 desenlaces + redacción (spec §6/§7) → F4. Data layer → F1. Navegación → F5. ✔
