# Goya Dashboard — Ultra-Modern Redesign

**Status:** Draft (awaiting user review)
**Date:** 2026-05-21
**Owner:** dmedaglia@riogas.com.uy
**Stack:** Next.js 16 (App Router) · Tailwind v4 · Radix UI · shadcn-style primitives · Geist fonts · recharts · leaflet · framer-motion · sonner · Sentry · LogRocket

---

## 1. Purpose and Success Criteria

Replace the current generic shadcn-slate visual identity of the Goya dashboard with a cohesive, on-brand, modern design system that:

- Establishes a distinct Riogas visual identity (deep ocean blue + flame orange) instead of the off-the-shelf slate palette.
- Adopts a contemporary visual language: Bento grids, subtle Glassmorphism on overlays, refined motion, tokenized chart palette.
- Modernizes the application shell (Navbar, Sidebar, Command Palette, Notifications, Chat, GlobalLoader) — the surfaces the user sees on every screen.
- Refines all 22 shadcn-style UI primitives so any consumer page inherits the new look without rewriting business logic.
- Re-treats the 9 dashboard sections with consistent page-layout patterns (Hub bento / Index+Detail / Split map / Settings tabs / Tool wizard).
- Maintains light + dark mode at equal polish, plus system-preference following.

**Success criteria:**

- The app, opened on any of the 9 dashboard sections, looks distinctly Riogas — not generic shadcn.
- A user can identify the brand color (Azul Riogas) and the action color (Naranja llama) without seeing the logo.
- All interactive primitives expose a visible focus ring, contrast WCAG AA, and respect `prefers-reduced-motion`.
- Every page header, empty state, and loading state follows the same pattern (no orphan styling).
- Each rollout phase is mergeable in isolation and the app functions at the end of each phase.

**Out of scope:**

- The `/login` route (explicitly excluded by the user).
- Backend changes (notifications integration is structural only; the actual notifications API is not part of this work).
- Removing `nivo` / `victory` libraries (consolidation to recharts is recommended but the cleanup PR is outside this spec).
- Internationalization changes.
- Sentry/LogRocket configuration changes.

---

## 2. Design Tokens

Replaces the contents of `:root` and `.dark` in `src/app/globals.css`.

### 2.1 Color tokens (OKLCH where Tailwind v4 supports it, hex documented for readability)

**Light theme**

| Token | Value (hex equivalent) | Use |
|---|---|---|
| `--background` | `#FAFBFC` | Canvas base (not pure white) |
| `--foreground` | `#0B1220` | Primary text |
| `--card` | `#FFFFFF` | Solid card surfaces |
| `--card-foreground` | `#0B1220` | Text on cards |
| `--muted` | `#F1F4F8` | Muted backgrounds (skeletons, hover states) |
| `--muted-foreground` | `#5A6478` | Muted text |
| `--border` | `#E4E8EE` | Standard borders |
| `--input` | `#E4E8EE` | Input borders |
| `--primary` | `#1E5BB8` | Azul Riogas (CTAs, links, active states) |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--accent` | `#FF7A1A` | Naranja llama (highlight, key CTAs) |
| `--accent-foreground` | `#FFFFFF` | Text on accent |
| `--success` | `#10B981` | Success states |
| `--warn` | `#F59E0B` | Warning states |
| `--destructive` | `#EF4444` | Error/destructive |
| `--ring` | `#1E5BB8` (50% alpha) | Focus ring |

**Dark theme**

| Token | Value (hex equivalent) | Notes |
|---|---|---|
| `--background` | `#0A0F1A` | Near-black blue |
| `--foreground` | `#E6ECF5` | High-contrast text |
| `--card` | `#0F1626` | Glass base step |
| `--card-foreground` | `#E6ECF5` | |
| `--muted` | `#131B2D` | |
| `--muted-foreground` | `#8693A8` | |
| `--border` | `#1E2740` | |
| `--primary` | `#4F7DD9` | Lifted for dark |
| `--accent` | `#FF8C3D` | Lifted for dark |

### 2.2 Chart palette (tokenized — replaces all hardcoded colors in current charts)

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `#1E5BB8` (primary blue) | `#4F7DD9` |
| `--chart-2` | `#3B82F6` (lighter blue) | `#60A5FA` |
| `--chart-3` | `#FF7A1A` (accent orange) | `#FF8C3D` |
| `--chart-4` | `#06B6D4` (cyan) | `#22D3EE` |
| `--chart-5` | `#8B5CF6` (soft purple) | `#A78BFA` |

### 2.3 Radii

```
--radius      0.875rem   (default: cards, dropdowns)
--radius-sm   0.5rem     (badges, small buttons)
--radius-md   0.75rem    (inputs, secondary cards)
--radius-lg   1rem       (main containers)
--radius-xl   1.5rem     (hero bento items, modals)
```

### 2.4 Shadows

```
--shadow-xs:  0 1px 2px rgba(11,18,32,.04)
--shadow-sm:  0 2px 6px rgba(11,18,32,.06), 0 1px 2px rgba(11,18,32,.04)
--shadow-md:  0 8px 24px -8px rgba(11,18,32,.10), 0 2px 6px rgba(11,18,32,.05)
--shadow-lg:  0 24px 48px -16px rgba(11,18,32,.16)
--shadow-glow-primary:  0 0 0 4px rgba(30,91,184,.18)
--shadow-glow-accent:   0 0 0 4px rgba(255,122,26,.22)
```

Dark equivalents use higher alpha and warmer ambient (the dark variants are defined inline in `.dark`).

### 2.5 Typography

Keep Geist Sans + Geist Mono (already loaded via `next/font/google`). Add font-feature-settings: `"ss01", "cv01", "tnum"` for tabular numerals in KPI/data contexts.

Scale (semantic class names exposed as Tailwind utilities via `@theme`):

```
text-display    3rem    700  letter-spacing -0.025em   (h1 hero)
text-h1         2rem    700  -0.02em
text-h2         1.5rem  600  -0.015em
text-h3         1.125rem 600
text-body       0.9375rem 400   (15px body default)
text-sm         0.8125rem 500
text-xs         0.75rem  500   uppercase tracking-wider
```

### 2.6 Density and spacing

Comfortable density (not compact, not roomy):
- Card padding: `1.25rem` (20px)
- Page padding: `p-6 md:p-8`
- Grid gap: `1rem` (16px)
- Input/Button height: `2.5rem` (40px)
- Section spacing: `space-y-6`

### 2.7 Motion tokens

```
--ease-out-quart   cubic-bezier(0.25, 1, 0.5, 1)
--ease-in-out      cubic-bezier(0.4, 0, 0.2, 1)
--duration-fast    150ms
--duration-base    250ms
--duration-slow    400ms
```

Existing keyframes (`fadeInUp`, `fadeInLeft`, `scaleIn`, `shimmer`, `shake`, `bellRing`, `pulseSoft`, `tableRowIn`) are preserved. All animations wrapped in `@media (prefers-reduced-motion: no-preference)`; under reduced-motion all `transition-*` and `animation-*` durations collapse to 0ms via a global override.

---

## 3. Visual Patterns

### 3.1 Glass surfaces (utility classes in `globals.css`)

```css
.surface-glass {
  background: color-mix(in oklch, var(--card) 78%, transparent);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid color-mix(in oklch, var(--border) 60%, transparent);
}
.surface-glass-strong {
  background: color-mix(in oklch, var(--card) 88%, transparent);
  backdrop-filter: blur(20px) saturate(160%);
  border-bottom: 1px solid var(--border);
}
```

**Glass is applied to:** navbar, sidebar, dialog/modal content, popovers, dropdowns, command palette, notification center, large table headers.

**Glass is NOT applied to:** KPI cards, chart cards, form fields, body content surfaces — these stay solid `--card` to keep readability and reduce visual noise.

### 3.2 Bento grid

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 1rem;
}
.bento-item        { grid-column: span 4; }
.bento-item-wide   { grid-column: span 8; }
.bento-item-full   { grid-column: span 12; }
.bento-item-hero   { grid-column: span 6; }

@media (max-width: 1024px) {
  .bento-grid { grid-template-columns: repeat(6, 1fr); }
  .bento-item-wide { grid-column: span 6; }
  .bento-item-hero { grid-column: span 6; }
}
@media (max-width: 640px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-item, .bento-item-wide, .bento-item-hero, .bento-item-full { grid-column: span 1; }
}
```

### 3.3 Surface hierarchy (3 levels)

- **Level 0** — `--background` (canvas base, includes a subtle radial gradient overlay in the dashboard layout: `--background` to one step lighter at the top, ~6% intensity)
- **Level 1** — `--card` solid: standard data cards, KPI cards, form sections
- **Level 2** — `.surface-glass`: floating overlays (modals, dropdowns, navbar, sidebar)
- **Hero variant** — Level 1 + a small `linear-gradient(135deg, var(--primary) 0%, transparent 40%)` overlay at ~6% opacity in the top-right corner. Used for ONE hero card per page maximum.

### 3.4 Card states

- **Default**: solid `--card`, `border 1px var(--border)`, `--shadow-sm`, `--radius-lg`
- **Hover**: `--shadow-md`, `transform: translateY(-2px)`, transition `--duration-base var(--ease-out-quart)`
- **Selected**: `border-color: var(--primary)`, `--shadow-glow-primary`
- **Loading**: skeleton shimmer overlay
- **Empty**: lucide icon at 40% opacity + title + subtitle + optional CTA — never a bare "No data" string

---

## 4. UI Primitives Strategy (`src/components/ui/`)

All 22 primitives are re-styled without API changes. Consumers do not need to be modified.

| Primitive | Key changes |
|---|---|
| `button.tsx` | Variants: default (primary), accent (orange CTA), secondary, outline, ghost, destructive. Sizes: sm/default/lg/icon. Focus uses `--shadow-glow-primary`. |
| `card.tsx` | 3 variants: default (solid), glass, hero (gradient overlay). Sub-components keep API. |
| `table.tsx` | Header uses `.surface-glass`. Rows: alternating subtle stripe, hover `--muted`, selected row gets left border `--primary` 3px + `bg color-mix(--primary 8%, --card)`. Only horizontal borders. |
| `dialog.tsx` + `modal.tsx` | `.surface-glass` content + `--shadow-lg` + `--radius-xl`. Entry animation: fade + scale(0.96→1) + translateY(8→0), 250ms `--ease-out-quart`. |
| `input.tsx`, `select.tsx`, `textarea` | Height 40px, `--radius-md`, 1.5px border, focus uses `--shadow-glow-primary`, error state uses `--destructive`. Optional left-icon slot. |
| `dropdown-menu.tsx`, `popover.tsx` | `.surface-glass`, `--shadow-md`, `scaleIn` animation. |
| `badge.tsx` | 5 tonal variants (default, success, warn, danger, info) — 12% bg of the color + solid foreground color. |
| `tabs.tsx` | Underline style: no pill background, 2px primary line under active tab. |
| `tooltip.tsx` | Inverted glass: `--foreground` bg, `--background` text. |
| `progress.tsx`, `slider.tsx` | Track `--muted`, fill is `linear-gradient(90deg, --primary, --accent)`. |
| `switch.tsx`, `checkbox.tsx` | Switch 44×24, thumb 20px, on=`--primary`. Checkbox 18×18, `--radius-sm`, checked with lucide check icon. |
| `sonner.tsx` | Glass toasts, bottom-right, variants color-coded. |
| `pagination.tsx` | Outline buttons + solid `--primary` for active page. |
| `avatar.tsx`, `alert.tsx`, `accordion.tsx`, `label.tsx`, `CollapsibleCard.tsx` | Token refresh only. |

---

## 5. Shell (always-visible UI)

### 5.1 Navbar

`src/components/dashboard/Navbar.tsx` — sticky top, `z-50`, height 60px, `.surface-glass-strong`.

Layout:
```
[≡] [Logo Riogas]  Breadcrumb   ─────   [🔍 Cmd+K] [🔔 badge] [🌓] [👤 ▾]
```

Components:
- **Hamburger** toggles sidebar collapse, persisted in localStorage `goya:sidebar:collapsed`
- **Logo** links to `/dashboard`
- **Breadcrumb** (new component `Breadcrumbs.tsx`) — derived from `usePathname()`, last segment bold `--foreground`, others `--muted-foreground` with hover
- **Search trigger** opens Command Palette (`CommandPalette.tsx`, see 5.4)
- **Notifications** opens Notification Center (`NotificationCenter.tsx`, see 5.5)
- **Theme toggle** (`ThemeToggle.tsx`) cycles light → dark → system, lucide Sun/Moon/Monitor icon
- **User menu** dropdown (`UserMenu.tsx`) — avatar + name + role + menu (Perfil, Configuración, Cambiar contraseña, Cerrar sesión)
- Animation: `fadeInDown` on mount

### 5.2 Sidebar

`src/components/dashboard/Sidebar.tsx` — `position: fixed`, left, full-height, `.surface-glass-strong`, `border-right 1px var(--border)`.

States:
- Expanded: 240px width
- Collapsed: 64px width (icons only + tooltip on hover)
- Mobile (`< 768px`): drawer overlay with backdrop, opened via navbar hamburger

Item structure:
- Padding `0.625rem 0.875rem`, `--radius-md`, gap `0.5rem`
- Icon: lucide-react 16px
- Label: `text-sm font-medium`
- Active item: `bg color-mix(--primary 10%, transparent)`, `border-left 3px var(--primary)`, text `--primary`, `aria-current="page"`
- Hover (inactive): bg `--muted`

Sections (separated by uppercase `text-xs` labels with tracking-wider muted-foreground):

```
PINEADOS    (user-pinned, max 3, persisted in localStorage)
  …

OPERACIÓN
  📊 Panel       /dashboard
  📦 Pedidos     /dashboard/pedidos
  🚐 Móviles     /dashboard/moviles
  👥 Clientes    /dashboard/clientes
  🗺  Mapa        /dashboard/mapa
  🔧 Services    /dashboard/services

HERRAMIENTAS
  🧭 Normalizar calles  /dashboard/normalizar-calles

ADMIN
  👤 Usuarios       /dashboard/usuarios
  ⚙  Configuración  /dashboard/configuracion
```

Pin/unpin via a small lucide Pin icon visible on hover. Persisted in `goya:sidebar:pinned`.

Collapse animation: `width 240→64` with `--ease-out-quart` 250ms; labels fade-out simultaneously.

### 5.3 Chat floating widget

`src/components/chat/ChatProvider.tsx`:
- FAB 56px, fixed bottom-right, `linear-gradient(135deg, --primary, --accent)`, `--shadow-lg`, icon lucide `MessageCircle`
- Hover: scale 1.05 + `--shadow-glow-primary`
- New notification: lucide-dot badge with `pulseSoft` animation (existing keyframe)
- Panel on click: glass card 380×520, slide-up animation, `--radius-xl`

### 5.4 Command Palette (new)

`src/components/dashboard/CommandPalette.tsx`:
- Dependency: `cmdk` (new dep, ~6KB)
- Trigger: Cmd+K / Ctrl+K (global keyboard handler in `DashboardClient.tsx`)
- Overlay: bg black 50% + backdrop-blur
- Content: `.surface-glass`, max-width 640px, `--radius-xl`
- Lists: Navigation (the 9 sections), Quick actions (toggle theme, sign out, search clientes, search pedidos), Recent (last 5 visited pages from localStorage)
- Keyboard nav: arrows + Enter, Esc closes
- Search field auto-focused on open

### 5.5 Notification Center (structural)

`src/components/dashboard/NotificationCenter.tsx`:
- Popover triggered from navbar bell
- Glass panel, width 380px
- Sections: Hoy / Anteriores
- Each item: icon by type (info/success/warn) + title + relative time + optional CTA
- "Marcar todas como leídas" button top-right
- **Note:** This component renders structure only. The actual data source (backend notifications API) is not part of this redesign. A `useNotifications()` hook stub is created with a mock empty list; integration is a follow-up.

### 5.6 GlobalLoader

`src/components/GlobalLoader.tsx` + `lib/GlobalLoadingOverlay.tsx`:
- Overlay: `bg-background/70 backdrop-blur-md`
- Spinner: SVG circle with `linear-gradient(--primary, --accent)` stroke, 48px, 1s rotation, `--ease-in-out`
- Optional text below: `text-muted-foreground text-sm`
- Fade-in/out 150ms, no flicker (debounce ≥120ms before showing)

### 5.7 Theme system

`src/components/ThemeProvider.tsx` (new):
- Modes: `light` | `dark` | `system`
- Default: `system`
- Reads `prefers-color-scheme` for `system` mode
- Persists in localStorage `goya:theme`
- Applies `.dark` class on `<html>` (matches current convention)
- Avoids hydration flash via inline `<script>` in `<head>` of `layout.tsx`

### 5.8 Page header (new component)

`src/components/ui/PageHeader.tsx`:
- Props: `title: string`, `description?: string`, `actions?: ReactNode`, `breadcrumbs?: boolean` (default true)
- Layout: `flex items-end justify-between`, `mb-6`
- All dashboard pages adopt this header (uniformity)

---

## 6. Page-Layout Patterns

Each page maps to one pattern. Patterns are documented; specific page implementations are described in the rollout plan.

### Pattern A — Hub Bento (KPIs + charts)
**Applies to:** `/dashboard` (Panel principal)

```
[Hero KPI span 6] [KPI span 2] [KPI span 2] [KPI span 2]
[Chart wide span 8                       ] [Side stat 4]
[Tabla actividad reciente span 12]
```

### Pattern B — Index + Detail
**Applies to:** `/dashboard/pedidos`, `/dashboard/clientes`, `/dashboard/usuarios`, `/dashboard/moviles` (list view), `/dashboard/services`

```
PageHeader (title + actions: "Nuevo X")
Stats row (3-4 KPI compactos contextuales)
Filtros sticky (search + chips + sort)
Tabla con paginación + selección múltiple
  ↳ Acciones bulk en sticky bar al seleccionar
```

Detail view: side Sheet/drawer (preferred) or full page if complex. Drawer keeps page context.

### Pattern C — Split map + list
**Applies to:** `/dashboard/mapa`, `/dashboard/moviles` (map view)

```
[Leaflet map 60%]  [Filtros + lista + selected item panel 40%]
```

- Leaflet tiles tematizadas (light/dark variants)
- Custom marker icons in Riogas palette
- Item click → marker highlight + smooth zoom
- Panel collapsible on mobile

### Pattern D — Settings tabs
**Applies to:** `/dashboard/configuracion`

```
[Sub-sidebar 240px (sections)]  [Form area glass card]
```

### Pattern E — Tool / Wizard
**Applies to:** `/dashboard/normalizar-calles`

- Centered card max-width 800px
- Vertical steps with progress bar
- Primary action bottom-right (gradient primary→accent)

### Pattern F — Error page
**Applies to:** `/no-autorizado`

- Centered card with lucide icon + title + description + "Volver" button

### Global page rules

- Every page uses `PageHeader`
- Empty states: lucide icon (40% opacity) + title + description + optional CTA
- Loading: pattern-specific skeleton (not generic spinner)
- Error: card with lucide icon + retry CTA
- Entry animation: cascade of `fadeInUp` with stagger (KPIs → charts → table)

---

## 7. Charts

- **Library:** Standardize on `recharts` (already used on the home page). `nivo` and `victory` remain installed but new components do not use them. Cleanup PR is out of scope.
- **Wrapper:** `src/components/dashboard/charts/ChartCard.tsx`:
  - Props: `title`, `description?`, `actions?`, `height? (default 280)`
  - Composition: `<Card>` with header (title/desc + actions) + `<ResponsiveContainer>` body
- **Variants:** `<AreaChartCard>`, `<BarChartCard>`, `<LineChartCard>`, `<DonutChartCard>` — preset wrappers with sensible defaults
- **Colors:** All `stroke` / `fill` read from CSS vars (`var(--chart-1)` … `var(--chart-5)`)
- **Tooltip:** custom component using `.surface-glass` + `--shadow-md`, replaces recharts default
- **Grid:** horizontal lines only, `--border` 0.3 opacity, dashed `3 3`
- **Axes:** tick `--muted-foreground`, no axis line
- **Animation:** `animationDuration={800}`, `--ease-out-quart`
- **Empty state:** lucide `BarChart3` 30% + "Sin datos en este rango"

---

## 8. Accessibility (non-negotiable)

- **Contrast WCAG AA**: foreground/background ≥ 4.5:1, large text ≥ 3:1
  - Verified: `#1E5BB8` on `#FFFFFF` = 7.2:1 ✓
  - `#FF7A1A` on `#FFFFFF` = 3.1:1 → orange is NOT used for body text, only CTAs and badges-with-background
- **Focus visible always**: 2px ring `--primary` + 2px offset on every interactive element
- **Skip link**: "Saltar al contenido principal" as first tabbable in `DashboardClient.tsx`
- **Sidebar active item**: `aria-current="page"`
- **Glass surfaces**: blur tested against long body text; if illegible, increase opacity (88% min for navbar/sidebar)
- **`prefers-reduced-motion`**: all animations and transitions wrapped; under reduced motion durations are 0ms via global rule:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0ms !important;
      transition-duration: 0ms !important;
    }
  }
  ```
- **Keyboard navigation**: Command palette globally available (Cmd+K), full arrow-key navigation. Sidebar and navbar Tab-traversable.
- **Color is never the only signal**: status badges always combine icon + color
- **Form errors**: announced via `aria-describedby` + `aria-invalid`

---

## 9. Rollout Phases

Each phase is mergeable in isolation; the app functions at the end of each phase. Verification with screenshots and Playwright before moving on.

### Phase 1 — Foundation (1-2 days)

**Scope:**
- Rewrite `src/app/globals.css` `:root` and `.dark` with new tokens (Section 2)
- Add motion tokens and `prefers-reduced-motion` global rule
- Inventory all hardcoded hex colors across `src/` (initial grep flagged ~12 files including `src/app/dashboard/page.tsx`, `src/components/dashboard/Navbar.tsx`, `src/components/mapa/*`, `src/components/configuracion/*`, `src/components/clientes/ClienteForm.tsx`, `src/app/no-autorizado/*`). Replace chart/UI colors with `var(--chart-N)` or `var(--primary/accent/...)` tokens. Map/leaflet colors keep concrete values where required by leaflet APIs but reference token-derived hex where possible.
- Add `font-feature-settings` for tabular numerals
- Validate contrast with a Node script (one-off, kept in `scripts/check-contrast.ts`)

**Deliverable:** App functions identically but with the Riogas palette. No surfaces are re-styled yet.

**Verification:**
- Screenshots of `/dashboard` + `/dashboard/pedidos` (or whichever index has data) in light + dark, before / after
- All existing Playwright tests pass
- Manual: no rendering glitches, no chart color regressions

**Risk:** Minimal. Variables-only change.

### Phase 2 — UI Primitives (3-4 days)

**Scope:**
- Re-style all 22 components in `src/components/ui/` per Section 4
- Preserve all public props (TypeScript signatures unchanged)
- Add the utility classes `.surface-glass`, `.surface-glass-strong`, `.bento-grid`, `.bento-item-*` to `globals.css`
- Add `PageHeader.tsx` (new primitive used in Phase 4)

**Deliverable:** All consuming pages automatically inherit the new look on cards, buttons, tables, modals, dropdowns, badges, inputs, etc.

**Verification:**
- Screenshots of 4-5 representative pages
- Manual click-through: open every Dialog / Dropdown / Popover / Modal in the app
- All Playwright tests pass
- Type check passes (`tsc --noEmit`)

**Risk:** Medium. Mitigation: grep for each primitive's usage before changing internals; commit one primitive at a time within the branch.

### Phase 3 — Shell (2-3 days)

**Scope:**
- Redesign `Navbar.tsx`, `Sidebar.tsx`, `GlobalLoader.tsx`, `GlobalLoadingOverlay.tsx`, `ChatProvider.tsx`
- New: `Breadcrumbs.tsx`, `CommandPalette.tsx` (depends on new dep `cmdk`), `NotificationCenter.tsx` (structural, mock data), `ThemeProvider.tsx`, `ThemeToggle.tsx`, `UserMenu.tsx`
- Wire global Cmd+K handler in `DashboardClient.tsx`
- Update `src/app/dashboard/layout.tsx` to include `ThemeProvider` and skip-link
- Persistence: `goya:sidebar:collapsed`, `goya:sidebar:pinned`, `goya:theme`, `goya:recent-pages`

**Deliverable:** The app feels "ultra modern" the moment you open it. Cmd+K functional. Theme toggle with system support. Sidebar collapsible and pinnable.

**Verification:**
- Screenshots of shell in 3 states: expanded sidebar, collapsed sidebar, command palette open — both light + dark
- Theme persistence across reloads
- Sidebar state persistence across reloads
- All Playwright tests pass
- SSR/hydration: no console warnings about mismatch
- New dep `cmdk` is approved (small, well-maintained, MIT)

**Risk:** Medium-high. NavbarServer touches middleware/auth — careful SSR handling required.

### Phase 4 — Pages (4-7 days, in sub-phases)

#### 4.1 Home — `/dashboard` (1 day)
- Apply Pattern A (Hub Bento)
- Hero KPI with gradient
- Charts use new `ChartCard` wrapper and tokenized palette
- Cascade entry animation (KPIs → charts → table)

#### 4.2 High-traffic — `/pedidos`, `/moviles`, `/clientes` (2 days)
- Apply Pattern B (Index + Detail)
- Use `PageHeader`
- Stats row + sticky filters + modern table
- Detail in side Sheet (where feasible)

#### 4.3 Map — `/mapa`, `/moviles` map view (1 day)
- Apply Pattern C (Split map + list)
- Leaflet tile theming (light/dark)
- Riogas-palette marker icons

#### 4.4 Remaining — `/usuarios`, `/services`, `/configuracion`, `/normalizar-calles`, `/no-autorizado` (1-2 days)
- `/usuarios` + `/services` → Pattern B
- `/configuracion` → Pattern D
- `/normalizar-calles` → Pattern E
- `/no-autorizado` → Pattern F

**Verification per sub-phase:**
- Screenshots golden path
- Manual click-through
- Playwright tests pass
- All forms still submit correctly (sanity)

**Risk:** Page by page. Each sub-phase is independent and mergeable.

### Total: 10-15 days of effective work

### Branching strategy

- Long-running integration branch: `redesign/ultra-modern` from `dev`
- Sub-branches per phase: `redesign/phase-1-foundation`, `redesign/phase-2-primitives`, `redesign/phase-3-shell`, `redesign/phase-4-1-home`, `redesign/phase-4-2-traffic`, `redesign/phase-4-3-map`, `redesign/phase-4-4-rest`
- Each phase PR → user review → merge to `redesign/ultra-modern`
- When all phases land on `redesign/ultra-modern` and user gives final OK → merge to `dev`, then `main` per project flow

### Rollback plan

- Each phase is an atomic, revertible PR
- Phase 1 (tokens) is ~80 lines in `globals.css` — trivial revert
- Phase 2 primitives are file-isolated — revert by file
- Phase 3 shell is the highest-risk revert; mitigated by keeping the old components untouched until shell PR is merged (e.g., new Navbar lives alongside old until cutover)

---

## 10. Open Questions and Assumptions

**Assumptions (proceeding unless flagged):**

1. The user is fine with the recommended density (comfortable, not compact). If the dashboard is used full-screen daily by power users who need maximum data on screen, we may want compact mode later.
2. `cmdk` as a new dependency is acceptable.
3. No internationalization concerns — current UI is Spanish (es-UY), staying that way.
4. The 9 routes listed in `src/app/dashboard/` are the complete set; no hidden routes outside `dashboard/`.
5. Notifications data integration is a follow-up project; structural UI is enough for now.
6. Authentication and middleware behavior is preserved exactly. Visual changes to NavbarServer only.

**Open (resolve before Phase 3):**
- Exact role/permissions visible in user menu — depends on auth payload structure. Will inspect during Phase 3.
- Whether Sentry/LogRocket overlays need theme awareness — likely not, but verify.

---

## 11. Testing Strategy

- **Existing Playwright tests** must continue to pass at the end of every phase
- **Visual smoke**: screenshots captured per phase (light + dark, primary routes), stored under `docs/superpowers/screenshots/redesign/phase-N/`
- **Type check**: `tsc --noEmit` clean at the end of every phase
- **Lint**: `pnpm lint` clean at the end of every phase
- **Manual click-through** per phase: enumerated in the verification section of each phase
- **No new unit/integration tests** are required by this redesign (it's primarily visual); existing E2E coverage is sufficient

---

## 12. Glossary

- **Bento grid** — Grid layout with mixed-size items, popular in 2024-2026 dashboards (Apple, Linear, Vercel).
- **Glassmorphism** — Translucent surfaces with `backdrop-filter: blur`, mimicking frosted glass.
- **OKLCH** — Modern perceptually-uniform color space; Tailwind v4 supports it natively.
- **Tonal badge** — Badge style where background is a translucent tint (~12%) of the color, foreground is the solid color. Modern alternative to "solid color" badges.
- **Surface hierarchy** — Layered approach to backgrounds (canvas → card → overlay) to convey depth without heavy shadows.
