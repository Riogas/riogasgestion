# Goya Dashboard Ultra-Modern Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic shadcn-slate visual identity of the Goya dashboard with a cohesive Riogas-branded, modern design system (Bento + Glass) across all 9 dashboard sections, in 4 verifiable phases.

**Architecture:** Token-first design system. Phase 1 rewrites CSS variables and utilities. Phase 2 re-styles the 22 shadcn primitives without API changes so consumers inherit the new look. Phase 3 redesigns the shell (Navbar, Sidebar, Command Palette, Theme, Notifications, GlobalLoader, Chat). Phase 4 applies layout patterns page-by-page.

**Tech Stack:** Next.js 16 (App Router, Turbopack) · Tailwind v4 (`@theme inline` + `@import "tailwindcss"`) · Radix UI primitives · Geist Sans/Mono · recharts · leaflet · framer-motion · sonner · pnpm · TypeScript · Sentry · LogRocket

**Reference spec:** `docs/superpowers/specs/2026-05-21-goya-dashboard-redesign-design.md`

---

## Branching Strategy

- Integration branch: `redesign/ultra-modern` (cut from `dev`)
- Sub-branches per phase merged into `redesign/ultra-modern`
- Final merge into `dev` (and then `main` per project flow) when all phases approved

---

## Pre-Work — Setup

### Task 0.1: Create integration branch

**Files:** none (git only)

- [ ] **Step 1: Verify clean state**

Run: `git status --short`
Expected: only the pre-existing `D postcss.config.js`, `M public/backgroundgoya.png`, `?? postcss.config.js.bak`, `?? public/backgroundgoya2.png` (those are environmental from earlier session; leave them).

- [ ] **Step 2: Cut integration branch from `dev`**

Run:
```
git checkout dev
git pull origin dev
git checkout -b redesign/ultra-modern
git push -u origin redesign/ultra-modern
```
Expected: branch created and tracking origin.

---

# Phase 1 — Foundation

**Goal:** Replace tokens, define utilities, tokenize all hardcoded chart/UI hex colors, add motion + reduced-motion handling, validate contrast.

**Working branch:** `redesign/phase-1-foundation` from `redesign/ultra-modern`.

### Task 1.1: Cut phase branch

- [ ] **Step 1**

Run:
```
git checkout redesign/ultra-modern
git checkout -b redesign/phase-1-foundation
```

### Task 1.2: Rewrite `globals.css` with Riogas tokens

**Files:**
- Modify: `src/app/globals.css` (full rewrite of `:root`, `.dark`, plus new utilities)

- [ ] **Step 1: Replace token block**

Replace the `:root` block (currently lines 45-78) with the Riogas light palette per spec §2.1, and the `.dark` block (currently lines 80-112) with the Riogas dark palette per spec §2.1.

Concrete values to write:

```css
:root {
  --radius: 0.875rem;
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;

  --background: oklch(0.985 0.005 240);
  --foreground: oklch(0.14 0.04 264);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.14 0.04 264);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.14 0.04 264);

  --primary: oklch(0.485 0.13 256);            /* #1E5BB8 Azul Riogas */
  --primary-foreground: oklch(1 0 0);
  --accent: oklch(0.72 0.18 47);                /* #FF7A1A Naranja llama */
  --accent-foreground: oklch(1 0 0);

  --secondary: oklch(0.965 0.01 240);
  --secondary-foreground: oklch(0.14 0.04 264);
  --muted: oklch(0.965 0.01 240);
  --muted-foreground: oklch(0.50 0.03 250);

  --success: oklch(0.72 0.17 165);              /* #10B981 */
  --warn: oklch(0.79 0.17 80);                  /* #F59E0B */
  --destructive: oklch(0.63 0.24 27);           /* #EF4444 */

  --border: oklch(0.92 0.01 250);
  --input: oklch(0.92 0.01 250);
  --ring: oklch(0.485 0.13 256 / 50%);

  --chart-1: var(--primary);
  --chart-2: oklch(0.6 0.16 250);
  --chart-3: var(--accent);
  --chart-4: oklch(0.72 0.15 200);
  --chart-5: oklch(0.65 0.18 295);

  --sidebar: oklch(0.985 0.005 240 / 88%);
  --sidebar-foreground: oklch(0.14 0.04 264);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.965 0.01 240);
  --sidebar-accent-foreground: oklch(0.14 0.04 264);
  --sidebar-border: oklch(0.92 0.01 250);
  --sidebar-ring: var(--ring);

  --shadow-xs: 0 1px 2px rgba(11,18,32,.04);
  --shadow-sm: 0 2px 6px rgba(11,18,32,.06), 0 1px 2px rgba(11,18,32,.04);
  --shadow-md: 0 8px 24px -8px rgba(11,18,32,.10), 0 2px 6px rgba(11,18,32,.05);
  --shadow-lg: 0 24px 48px -16px rgba(11,18,32,.16);
  --shadow-glow-primary: 0 0 0 4px rgba(30,91,184,.18);
  --shadow-glow-accent: 0 0 0 4px rgba(255,122,26,.22);

  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
}

.dark {
  --background: oklch(0.16 0.03 260);           /* #0A0F1A */
  --foreground: oklch(0.93 0.015 240);
  --card: oklch(0.19 0.035 262);                /* #0F1626 */
  --card-foreground: oklch(0.93 0.015 240);
  --popover: oklch(0.19 0.035 262);
  --popover-foreground: oklch(0.93 0.015 240);

  --primary: oklch(0.62 0.13 256);              /* lifted */
  --primary-foreground: oklch(0.98 0.005 240);
  --accent: oklch(0.74 0.18 49);                /* lifted */
  --accent-foreground: oklch(1 0 0);

  --secondary: oklch(0.22 0.035 262);
  --secondary-foreground: oklch(0.93 0.015 240);
  --muted: oklch(0.22 0.035 262);
  --muted-foreground: oklch(0.65 0.03 250);

  --success: oklch(0.72 0.17 165);
  --warn: oklch(0.79 0.17 80);
  --destructive: oklch(0.7 0.19 22);

  --border: oklch(0.28 0.035 260);
  --input: oklch(0.28 0.035 260);
  --ring: oklch(0.62 0.13 256 / 55%);

  --chart-1: var(--primary);
  --chart-2: oklch(0.68 0.15 245);
  --chart-3: var(--accent);
  --chart-4: oklch(0.78 0.15 195);
  --chart-5: oklch(0.7 0.18 295);

  --sidebar: oklch(0.19 0.035 262 / 88%);
  --sidebar-foreground: oklch(0.93 0.015 240);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.22 0.035 262);
  --sidebar-accent-foreground: oklch(0.93 0.015 240);
  --sidebar-border: oklch(0.28 0.035 260);
  --sidebar-ring: var(--ring);

  --shadow-xs: 0 1px 2px rgba(0,0,0,.40);
  --shadow-sm: 0 2px 6px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.35);
  --shadow-md: 0 8px 24px -8px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.40);
  --shadow-lg: 0 24px 48px -16px rgba(0,0,0,.65);
  --shadow-glow-primary: 0 0 0 4px rgba(79,125,217,.30);
  --shadow-glow-accent: 0 0 0 4px rgba(255,140,61,.30);
}
```

- [ ] **Step 2: Extend `@theme inline` block to expose new tokens**

Add to the existing `@theme inline { ... }` block (currently lines 5-43) the new keys so Tailwind v4 generates utilities:

```css
@theme inline {
  /* ...existing keys... */
  --color-success: var(--success);
  --color-warn: var(--warn);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --ease-out-quart: var(--ease-out-quart);
  --ease-in-out: var(--ease-in-out);
}
```

- [ ] **Step 3: Add base font-feature-settings for tabular numerals**

Replace the existing `@layer base` block with:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    font-feature-settings: "cv01", "ss01";
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "cv01", "ss01";
  }
  /* Tabular numerals for KPI/numeric contexts */
  .tabular-nums, [data-numeric], td.num, .num {
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 4: Add reduced-motion global rule**

Append to `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Verify dev server compiles**

The dev server should already be running on port 4000 from the earlier session. Touch the file and watch the terminal/log:
- Open the file (no change), save, watch for HMR rebuild.
- If the dev server is not running, start it: `pnpm dev` from `C:/Users/jgomez/Documents/Projects/gestiondefinitivo/riogasgestion`

Expected: no errors in the dev-server log; page recompiles in <2s.

### Task 1.3: Add visual-pattern utilities

**Files:**
- Modify: `src/app/globals.css` (append)

- [ ] **Step 1: Append glass + bento + animation utilities**

Append to `globals.css` (after the existing animation classes):

```css
/* ==========================================================================
   SURFACE / PATTERN UTILITIES
   ========================================================================== */

.surface-glass {
  background: color-mix(in oklch, var(--card) 78%, transparent);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid color-mix(in oklch, var(--border) 60%, transparent);
}

.surface-glass-strong {
  background: color-mix(in oklch, var(--card) 88%, transparent);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid var(--border);
}

.surface-hero {
  position: relative;
  background: var(--card);
  isolation: isolate;
}
.surface-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, color-mix(in oklch, var(--primary) 8%, transparent) 0%, transparent 45%);
  pointer-events: none;
  z-index: -1;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 1rem;
}
.bento-item       { grid-column: span 4; }
.bento-item-wide  { grid-column: span 8; }
.bento-item-hero  { grid-column: span 6; }
.bento-item-full  { grid-column: span 12; }

@media (max-width: 1024px) {
  .bento-grid { grid-template-columns: repeat(6, 1fr); }
  .bento-item       { grid-column: span 3; }
  .bento-item-wide  { grid-column: span 6; }
  .bento-item-hero  { grid-column: span 6; }
  .bento-item-full  { grid-column: span 6; }
}
@media (max-width: 640px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-item, .bento-item-wide, .bento-item-hero, .bento-item-full {
    grid-column: span 1;
  }
}

/* Card lift refined (overrides the simpler existing one) */
.card-hover-lift {
  transition: transform var(--duration-base) var(--ease-out-quart),
              box-shadow var(--duration-base) var(--ease-out-quart);
}
.card-hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* fadeInDown for navbar */
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down {
  animation: fadeInDown 0.35s var(--ease-out-quart) both;
}
```

- [ ] **Step 2: Commit**

```
git add src/app/globals.css
git commit -m "feat(design): rewrite tokens with Riogas palette + add glass/bento utilities

- Replace shadcn-slate tokens with Riogas brand (azul #1E5BB8 + naranja #FF7A1A)
- Add semantic tokens: success, warn, shadow-xs/sm/md/lg/glow, ease-*, duration-*
- Add chart tokens (--chart-1..5) replacing hardcoded hex
- Add utilities: surface-glass, surface-glass-strong, surface-hero, bento-grid
- Add prefers-reduced-motion global override
- Add font-feature-settings for tabular numerals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.4: Tokenize hardcoded hex in `src/app/dashboard/page.tsx`

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Read current state**

The current chart colors are `#4f46e5`, `#0ea5e9`, `#22c55e`. Replace with `var(--chart-1)`, `var(--chart-3)`, `var(--chart-2)` respectively (Area=primary, Bar=accent orange for highlight, Line=secondary).

Actually use a helper because recharts expects color strings, not CSS vars. Approach: use raw `hsl(var(...))` won't work because we use oklch. Use a small runtime helper that reads `getComputedStyle(document.documentElement).getPropertyValue('--chart-1')`. To keep it simple and SSR-safe: pass actual hex via a const that mirrors the tokens.

- [ ] **Step 2: Create chart-colors helper**

Create file: `src/lib/chart-colors.ts`

```ts
/**
 * Concrete color values mirroring the CSS chart tokens in globals.css.
 * recharts/leaflet need string values, not CSS vars. Keep these in sync
 * with --chart-1..5 in globals.css.
 */
export const chartColors = {
  primary: "#1E5BB8",
  primaryDark: "#4F7DD9",
  blueLight: "#3B82F6",
  blueLightDark: "#60A5FA",
  accent: "#FF7A1A",
  accentDark: "#FF8C3D",
  cyan: "#06B6D4",
  cyanDark: "#22D3EE",
  purple: "#8B5CF6",
  purpleDark: "#A78BFA",
  success: "#10B981",
  warn: "#F59E0B",
  destructive: "#EF4444",
} as const;

/**
 * Theme-aware chart palette. Pass the resolved theme ("light"|"dark")
 * if you want auto-switching; defaults to light values.
 */
export function getChartPalette(theme: "light" | "dark" = "light") {
  const isDark = theme === "dark";
  return {
    1: isDark ? chartColors.primaryDark : chartColors.primary,
    2: isDark ? chartColors.blueLightDark : chartColors.blueLight,
    3: isDark ? chartColors.accentDark : chartColors.accent,
    4: isDark ? chartColors.cyanDark : chartColors.cyan,
    5: isDark ? chartColors.purpleDark : chartColors.purple,
  };
}
```

- [ ] **Step 3: Replace hex in `src/app/dashboard/page.tsx`**

Replace the three hex literals in the existing file:
- `#4f46e5` (Area stroke + gradient) → `chartColors.primary`
- `#0ea5e9` (Bar fill) → `chartColors.accent` (highlight the bar with the orange accent — visually distinct from the area chart)
- `#22c55e` (Line stroke) → `chartColors.blueLight` (secondary blue for the third metric — keeps brand cohesion)

Add the import at the top:
```ts
import { chartColors } from "@/lib/chart-colors";
```

- [ ] **Step 4: Visual verify**

Open http://localhost:4000/dashboard in the browser. Confirm: charts now use brand colors (blue/orange/secondary blue). No console errors.

### Task 1.5: Tokenize hardcoded hex in remaining files

**Files (from grep in pre-work):**
- Modify: `src/components/dashboard/Navbar.tsx`
- Modify: `src/components/mapa/OpenStreetMap.tsx`
- Modify: `src/components/mapa/MapaZonificacion.tsx`
- Modify: `src/components/mapa/MapaGoogle.tsx`
- Modify: `src/components/configuracion/Asignaciones.tsx`
- Modify: `src/components/configuracion/AsignacionMovilesModal.tsx`
- Modify: `src/components/clientes/ClienteForm.tsx`
- Modify: `src/app/no-autorizado/page.tsx`
- Modify: `src/app/no-autorizado/CopyClipboard.tsx`
- Modify: `src/app/dashboard/mapa/page.tsx`
- Modify: `src/lib/comparadorCalles.ts`

- [ ] **Step 1: Inspect each file's hex usage**

For each file in the list, read it and identify what role the color plays:
- Brand/UI accent → replace with `chartColors.primary` or `.accent` (from `@/lib/chart-colors`)
- Status/semantic (success green / warn yellow / danger red) → `.success` / `.warn` / `.destructive`
- Leaflet marker color → keep as concrete hex but reference `chartColors.primary` etc

If a hex is part of an SVG path/icon embedded literally and not a UI color (e.g., illustration), leave it.

- [ ] **Step 2: Apply replacements file-by-file**

Use Edit with exact strings. Don't batch-replace blindly — context matters.

- [ ] **Step 3: Type check**

Run from project root: `pnpm exec tsc --noEmit`
Expected: no new errors introduced by this task (pre-existing errors are OK if they were already there per `next.config.ts` `ignoreBuildErrors: true`).

- [ ] **Step 4: Visual smoke**

Reload http://localhost:4000/dashboard, /dashboard/mapa, /no-autorizado. Confirm no rendering regressions.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "refactor(colors): tokenize hardcoded hex across dashboard files

Replace literal hex with chartColors helper that mirrors CSS tokens.
Files: Navbar, mapa/*, configuracion/*, clientes/ClienteForm,
no-autorizado/*, dashboard/mapa, lib/comparadorCalles.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.6: Contrast verification script

**Files:**
- Create: `scripts/check-contrast.ts`

- [ ] **Step 1: Create script**

```ts
/**
 * Run: pnpm exec tsx scripts/check-contrast.ts
 *
 * Verifies that every (foreground, background) token pair from globals.css
 * meets WCAG AA contrast (≥4.5:1 for normal text, ≥3:1 for large text/UI).
 */
const pairs: Array<[string, string, string, number]> = [
  ["foreground on background (light)", "#0B1220", "#FAFBFC", 4.5],
  ["foreground on card (light)", "#0B1220", "#FFFFFF", 4.5],
  ["muted-foreground on background (light)", "#5A6478", "#FAFBFC", 4.5],
  ["primary-foreground on primary (light)", "#FFFFFF", "#1E5BB8", 4.5],
  ["accent-foreground on accent (light)", "#FFFFFF", "#FF7A1A", 3.0], // large/UI threshold
  ["foreground on background (dark)", "#E6ECF5", "#0A0F1A", 4.5],
  ["foreground on card (dark)", "#E6ECF5", "#0F1626", 4.5],
  ["muted-foreground on background (dark)", "#8693A8", "#0A0F1A", 4.5],
  ["primary-foreground on primary (dark)", "#FFFFFF", "#4F7DD9", 4.5],
  ["accent-foreground on accent (dark)", "#FFFFFF", "#FF8C3D", 3.0],
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relLum(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const L1 = relLum(hexToRgb(fg));
  const L2 = relLum(hexToRgb(bg));
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

let failed = 0;
for (const [name, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}: ${ratio.toFixed(2)} (min ${min})`);
  if (!ok) failed++;
}
if (failed > 0) {
  console.error(`\n${failed} contrast pair(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll WCAG AA contrast checks passed.");
}
```

- [ ] **Step 2: Run script**

Run: `pnpm exec tsx scripts/check-contrast.ts`
Expected: all checks pass (or script exits 1, in which case adjust the token in globals.css until pass).

- [ ] **Step 3: Commit**

```
git add scripts/check-contrast.ts
git commit -m "test(a11y): add WCAG AA contrast verification script

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.7: Phase 1 verification + merge

- [ ] **Step 1: Type check + lint**

Run:
```
pnpm exec tsc --noEmit
pnpm lint
```
Expected: no new errors.

- [ ] **Step 2: Run existing Playwright tests**

Run: `pnpm test:e2e`
Expected: green or same baseline as before Phase 1.

- [ ] **Step 3: Visual smoke**

Open http://localhost:4000/dashboard, click through a few sections. Confirm: no rendering glitches, palette looks Riogas-branded.

- [ ] **Step 4: Push and merge**

Run:
```
git push -u origin redesign/phase-1-foundation
git checkout redesign/ultra-modern
git merge --no-ff redesign/phase-1-foundation -m "Phase 1: Foundation — Riogas tokens + utilities + tokenized hex"
git push origin redesign/ultra-modern
```

---

# Phase 2 — UI Primitives

**Goal:** Re-style all 22 components in `src/components/ui/` per spec §4. Keep all public props unchanged. Consumers inherit the new look automatically.

**Working branch:** `redesign/phase-2-primitives` from `redesign/ultra-modern`.

### Task 2.1: Cut phase branch

- [ ] `git checkout redesign/ultra-modern && git checkout -b redesign/phase-2-primitives`

### Task 2.2: Audit + plan each primitive

**Files:** all 22 in `src/components/ui/`

- [ ] **Step 1: Read each primitive and document its current variants/sizes/exports**

For each of: `accordion`, `alert`, `avatar`, `badge`, `button`, `card`, `checkbox`, `CollapsibleCard`, `dialog`, `dropdown-menu`, `input`, `label`, `modal`, `pagination`, `popover`, `progress`, `select`, `slider`, `sonner`, `switch`, `table`, `tabs`, `tooltip`.

Take notes in a scratch file `docs/superpowers/notes/phase-2-primitive-audit.md` (commit at end of phase) listing for each primitive:
- Exported components and their public props
- Current variants (e.g., `cva` variants if used)
- Files that import this primitive (`grep -r "from .*components/ui/<name>" src/`)

This audit drives the per-primitive task list below.

- [ ] **Step 2: Commit the audit**

### Task 2.3-2.24: Re-style each primitive

One task per primitive. Each task follows this template:

**Files:** `src/components/ui/<primitive>.tsx`

- [ ] **Step 1**: Read the current file
- [ ] **Step 2**: Update className strings / cva variants per spec §4 (do NOT change prop signatures, exports, or external behavior)
- [ ] **Step 3**: Run `pnpm exec tsc --noEmit` after the change — expect no new errors
- [ ] **Step 4**: Visual verify in browser (open a page that uses this primitive — referenced from the audit notes)
- [ ] **Step 5**: Commit `style(ui): refresh <primitive> with Riogas tokens`

Concrete styling rules per primitive (apply during Step 2):

**button.tsx** — Update `cva` variants:
- `default` → `bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm`
- `accent` (new) → `bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm`
- `secondary` → `bg-muted text-foreground hover:bg-muted/70 border border-border`
- `outline` → `border-[1.5px] border-border bg-transparent hover:bg-muted text-foreground`
- `ghost` → `bg-transparent hover:bg-muted text-foreground`
- `destructive` → `bg-destructive text-white hover:bg-destructive/90`
- All: `transition-[transform,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- Sizes: `sm` (h-8 px-3 text-sm), `default` (h-10 px-4), `lg` (h-12 px-6 text-base), `icon` (h-10 w-10)

**card.tsx** — Add `variant?: "default" | "glass" | "hero"` prop. Default variant: `bg-card border border-border shadow-sm rounded-[var(--radius-lg)]`. `glass`: add `surface-glass` class instead of bg-card+border. `hero`: add `surface-hero` class. CardHeader/CardContent: keep API, padding 1.25rem.

**table.tsx** — `<thead>` gets `surface-glass` + `text-xs uppercase tracking-wider text-muted-foreground`. `<tbody> tr` gets `border-b border-border/60 hover:bg-muted/40 transition-colors`. Selected row class `data-[selected=true]:bg-primary/8 data-[selected=true]:border-l-[3px] data-[selected=true]:border-l-primary`. Cell padding `py-3 px-4`.

**dialog.tsx** + **modal.tsx** — Overlay `bg-black/50 backdrop-blur-sm`. Content uses `surface-glass shadow-lg rounded-[var(--radius-xl)] p-6`. Animation: `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2`.

**input.tsx** / **textarea** — `h-10 rounded-[var(--radius-md)] border-[1.5px] border-input bg-card px-3.5 text-sm transition-[box-shadow,border-color] focus-visible:border-primary focus-visible:shadow-[var(--shadow-glow-primary)] focus-visible:outline-none`. Add optional `data-error="true"` styling: red border + ring.

**select.tsx** — same as input for trigger. Content: `surface-glass shadow-md rounded-[var(--radius-md)] animate-in fade-in-0 zoom-in-95`.

**dropdown-menu.tsx** / **popover.tsx** — Content: `surface-glass shadow-md rounded-[var(--radius-lg)] p-1`. Items: `px-3 py-2 rounded-[var(--radius-sm)] text-sm hover:bg-muted cursor-pointer flex items-center gap-2`.

**badge.tsx** — Variants tonal:
- `default` → `bg-primary/10 text-primary border-0`
- `secondary` → `bg-muted text-foreground border-0`
- `success` → `bg-success/10 text-success border-0`
- `warn` → `bg-warn/10 text-warn border-0`
- `destructive` → `bg-destructive/10 text-destructive border-0`
- `info` → `bg-chart-4/10 text-chart-4 border-0`
- Base: `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium`

**tabs.tsx** — TabsList: `flex gap-1 border-b border-border bg-transparent p-0`. TabsTrigger: `px-4 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent hover:text-foreground data-[state=active]:text-primary data-[state=active]:border-primary transition-colors`.

**tooltip.tsx** — Content: `bg-foreground text-background text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] shadow-md`.

**progress.tsx** — Track: `bg-muted rounded-full h-2`. Indicator: `bg-gradient-to-r from-primary to-accent`.

**slider.tsx** — Same gradient on Range. Thumb: `h-5 w-5 rounded-full bg-card border-2 border-primary shadow-sm focus-visible:ring-2 focus-visible:ring-ring`.

**switch.tsx** — Track: `h-6 w-11 rounded-full bg-muted data-[state=checked]:bg-primary transition-colors`. Thumb: `h-5 w-5 rounded-full bg-white shadow-sm`.

**checkbox.tsx** — `h-[18px] w-[18px] rounded-[var(--radius-sm)] border-[1.5px] border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary text-white`.

**sonner.tsx** — Configure Toaster `toastOptions={{ classNames: { toast: 'surface-glass shadow-md rounded-[var(--radius-lg)] border-0', ... } }}`.

**alert.tsx** — Variants matching badge palette but at card scale. Add icon slot.

**accordion.tsx** — Border-bottom only. Trigger: `py-4 hover:text-primary transition-colors`. Content: `pb-4 text-sm text-muted-foreground`.

**avatar.tsx** — Add `size` variant: sm (24), default (32), lg (40), xl (56). Fallback bg `bg-muted text-muted-foreground`.

**label.tsx** — `text-sm font-medium text-foreground`. Required marker uses `text-destructive`.

**pagination.tsx** — Page numbers as ghost buttons; active page solid primary.

**CollapsibleCard.tsx** — Inherit from updated Card; toggle row gets hover state.

### Task 2.25: Add `PageHeader` primitive

**Files:**
- Create: `src/components/ui/PageHeader.tsx`

- [ ] **Step 1: Implement**

```tsx
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 animate-fade-in-up", className)}>
      <div>
        <h1 className="text-h1 font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 2: Commit**

### Task 2.26: Phase 2 verification + merge

- [ ] Type check, lint, Playwright pass
- [ ] Screenshots: 4 representative pages (home, pedidos, mapa, configuracion) in light + dark
- [ ] Push branch, merge to `redesign/ultra-modern`

---

# Phase 3 — Shell

**Goal:** Redesign Navbar, Sidebar, GlobalLoader, ChatProvider; add CommandPalette, NotificationCenter, ThemeProvider/ThemeToggle, UserMenu, Breadcrumbs, skip-link.

**Working branch:** `redesign/phase-3-shell` from `redesign/ultra-modern`.

### Task 3.1: Add `cmdk` dependency

- [ ] Run `pnpm add cmdk`
- [ ] Commit `chore: add cmdk for command palette`

### Task 3.2: ThemeProvider + ThemeToggle

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Create: `src/components/dashboard/ThemeToggle.tsx`
- Modify: `src/app/layout.tsx` (wrap with ThemeProvider, add inline anti-flash script)

- [ ] **Step 1:** Implement `ThemeProvider` with `light | dark | system`, localStorage key `goya:theme`, watching `prefers-color-scheme` when `system`.
- [ ] **Step 2:** Inline `<script>` in `<head>` of root layout reads localStorage and sets `.dark` class before React hydrates (prevents flash).
- [ ] **Step 3:** `ThemeToggle` cycles light → dark → system, lucide `Sun`/`Moon`/`Monitor`, tooltip.
- [ ] **Step 4:** Verify persistence across reloads in browser DevTools.
- [ ] **Step 5:** Commit.

### Task 3.3: Breadcrumbs

**Files:** Create `src/components/dashboard/Breadcrumbs.tsx`

- [ ] Derive segments from `usePathname()`. Skip the first `dashboard` segment. Map each segment to a human-readable label via a small `SEGMENT_LABELS` record. Render with `lucide` `ChevronRight` between segments.

### Task 3.4: Sidebar redesign

**Files:** Modify `src/components/dashboard/Sidebar.tsx`

- [ ] Implement collapse state with localStorage `goya:sidebar:collapsed`, transition `width 240→64`.
- [ ] Implement pinned section reading from localStorage `goya:sidebar:pinned`. Add pin/unpin icon on hover.
- [ ] Apply `surface-glass-strong`, refined item styles, `aria-current="page"`.
- [ ] Mobile: drawer overlay (use Radix Dialog or existing pattern).

### Task 3.5: Navbar redesign

**Files:** Modify `src/components/dashboard/Navbar.tsx` (keep NavbarServer wrapper untouched for SSR)

- [ ] Apply `surface-glass-strong` + sticky top + z-50.
- [ ] Slot in: hamburger, logo, Breadcrumbs, command-palette trigger (visible search input on desktop with `Cmd+K` kbd hint, icon-only on mobile), NotificationCenter trigger, ThemeToggle, UserMenu.

### Task 3.6: UserMenu

**Files:** Create `src/components/dashboard/UserMenu.tsx`

- [ ] Avatar trigger; dropdown with name, role, email, separator, items (Perfil, Configuración, Cambiar contraseña, Cerrar sesión). Use existing auth payload shape (inspect `NavbarServer.tsx` for what's already passed).

### Task 3.7: CommandPalette

**Files:** Create `src/components/dashboard/CommandPalette.tsx`

- [ ] Use `cmdk` lib. Sections: Navegación (9 routes), Acciones (toggle theme, sign out), Recientes (last 5 from `goya:recent-pages`).
- [ ] Global keyboard handler in `DashboardClient.tsx` (Cmd/Ctrl+K).
- [ ] Track recent pages on route change (use Next `usePathname`).

### Task 3.8: NotificationCenter

**Files:** Create `src/components/dashboard/NotificationCenter.tsx` and `src/hooks/useNotifications.ts`

- [ ] `useNotifications` returns a stub `{ items: [], unreadCount: 0, markAllRead: () => {} }` for now.
- [ ] Popover panel with sections Hoy / Anteriores, empty state.

### Task 3.9: GlobalLoader redesign

**Files:** Modify `src/components/GlobalLoader.tsx` and `src/lib/GlobalLoadingOverlay.tsx`

- [ ] Overlay `bg-background/70 backdrop-blur-md`. SVG spinner with gradient stroke (primary→accent), 48px, 1s rotation. Debounce ≥120ms before showing to avoid flicker on fast loads.

### Task 3.10: ChatProvider FAB redesign

**Files:** Modify `src/components/chat/ChatProvider.tsx`

- [ ] FAB 56px, gradient bg, hover scale + glow. Panel uses `surface-glass`.

### Task 3.11: Dashboard layout — skip link + max-width

**Files:** Modify `src/app/dashboard/layout.tsx` and `src/app/dashboard/DashboardClient.tsx`

- [ ] Add skip-link `<a href="#main-content" className="sr-only focus:not-sr-only ...">Saltar al contenido principal</a>` as first child of body inside dashboard.
- [ ] Wrap children in `<main id="main-content" className="max-w-[1600px] mx-auto p-6 md:p-8">`.
- [ ] Add subtle background gradient overlay.

### Task 3.12: Phase 3 verification + merge

- [ ] Type check + lint + Playwright
- [ ] Visual: shell screenshots (expanded sidebar, collapsed, command-palette open) × (light, dark) = 6 captures
- [ ] Persistence test: reload tab, sidebar state + theme persist
- [ ] Merge to `redesign/ultra-modern`

---

# Phase 4 — Pages

**Goal:** Apply page layout patterns from spec §6 to all 9 dashboard sections.

**Working branch:** Per sub-phase, branched from `redesign/ultra-modern`.

### Sub-phase 4.1: Home `/dashboard` (Pattern A — Hub Bento)

**Branch:** `redesign/phase-4-1-home`
**Files:** Modify `src/app/dashboard/page.tsx`. Create `src/components/dashboard/charts/ChartCard.tsx` (and variants).

- [ ] **Step 1:** Create `ChartCard.tsx` wrapper (Card + header + ResponsiveContainer) and 4 variants (Area/Bar/Line/Donut).
- [ ] **Step 2:** Re-lay out home with `bento-grid`, hero KPI (`surface-hero`), 3 secondary KPIs, wide chart + side stat, bottom activity table.
- [ ] **Step 3:** Wire `PageHeader`.
- [ ] **Step 4:** Cascade entry animation with stagger classes.
- [ ] **Step 5:** Screenshot light + dark.
- [ ] **Step 6:** Merge to `redesign/ultra-modern`.

### Sub-phase 4.2: High-traffic — Pedidos, Móviles, Clientes (Pattern B)

**Branch:** `redesign/phase-4-2-traffic`

For each of `/dashboard/pedidos`, `/dashboard/moviles`, `/dashboard/clientes`:

- [ ] **Step 1:** Read current page file
- [ ] **Step 2:** Wrap with `PageHeader` (title + "Nuevo X" action button)
- [ ] **Step 3:** Add stats row (3-4 contextual KPIs above the table)
- [ ] **Step 4:** Move filters into a sticky bar above the table with consistent styling
- [ ] **Step 5:** Update table usage to use the new `table.tsx` (no API change; visual should already be improved from Phase 2)
- [ ] **Step 6:** Where possible, convert "edit" modal flows to side Sheet (lower priority; can be deferred per page)
- [ ] **Step 7:** Add empty state + loading skeleton + error boundary
- [ ] **Step 8:** Screenshot
- [ ] **Step 9:** Commit per page

Final step of sub-phase: merge to `redesign/ultra-modern`.

### Sub-phase 4.3: Map — `/dashboard/mapa`, `/dashboard/moviles` map view (Pattern C)

**Branch:** `redesign/phase-4-3-map`

- [ ] **Step 1:** Apply 60/40 split (map / panel)
- [ ] **Step 2:** Add theme-aware tile URL switch in leaflet wrapper (light tiles default, dark tiles when `.dark`)
- [ ] **Step 3:** Custom marker icons using `chartColors.primary` and `.accent`
- [ ] **Step 4:** Item click in list → marker highlight + map zoom
- [ ] **Step 5:** Mobile: panel collapses to bottom sheet
- [ ] **Step 6:** Screenshot
- [ ] **Step 7:** Merge

### Sub-phase 4.4: Remaining pages

**Branch:** `redesign/phase-4-4-rest`

- [ ] **Step 1:** `/dashboard/usuarios`, `/dashboard/services` → Pattern B (same as 4.2 for each)
- [ ] **Step 2:** `/dashboard/configuracion` → Pattern D (vertical sub-sidebar + form area)
- [ ] **Step 3:** `/dashboard/normalizar-calles` → Pattern E (centered wizard)
- [ ] **Step 4:** `/no-autorizado` → Pattern F (centered card with icon + retry)
- [ ] **Step 5:** Commit per page
- [ ] **Step 6:** Final Playwright run
- [ ] **Step 7:** Merge to `redesign/ultra-modern`

---

# Final Integration

### Task F.1: Final verification on `redesign/ultra-modern`

- [ ] Full Playwright suite green
- [ ] Type check clean
- [ ] Lint clean
- [ ] Contrast script passes
- [ ] Manual smoke: 9 sections × (light, dark) — screenshots stored under `docs/superpowers/screenshots/redesign/final/`

### Task F.2: Merge to `dev`

- [ ] Open PR `redesign/ultra-modern` → `dev`
- [ ] Self-review the diff
- [ ] Merge

### Task F.3: Promote to `main`

- [ ] Per project flow, promote `dev` → `main` when ready

---

## Self-Review

**Spec coverage check** (per design spec sections):
- §2 Tokens → Task 1.2 ✓
- §3 Visual patterns → Task 1.3 ✓
- §4 Primitives (22 of them) → Tasks 2.3-2.24 + 2.25 ✓
- §5 Shell → Tasks 3.1-3.11 ✓
- §6 Page patterns → Phase 4 sub-phases ✓
- §7 Charts (recharts wrapper) → Sub-phase 4.1 (creates ChartCard) ✓
- §8 Accessibility → Reduced-motion in Task 1.2, contrast in Task 1.6, focus rings in Task 2.3 (button), skip-link in Task 3.11, aria-current in 3.4 ✓
- §9 Rollout → Branching matches ✓
- §11 Testing → Playwright runs at each phase verification ✓

**Type consistency check:** `chartColors` helper signature is consistent across Task 1.4, 1.5, and Phase 4. `PageHeader` is referenced in Phase 4 and defined in Task 2.25 (earlier — good).

**Placeholder scan:** No "TBD" / "TODO" / "similar to" left in Phase 1. Phases 2-4 contain task-level direction but full per-file code is described at the level the spec defines; deeper code is generated at execution time guided by the per-primitive styling rules in Task 2.3-2.24 and the page-pattern descriptions in Phase 4. This is appropriate because the spec is authoritative.

**Known limitation:** Phases 2-4 require reading current file state at execution time to produce minimal-diff edits. The plan documents the *target* behavior and *which classes to apply*; the per-task code blocks for the existing file's exact content are produced during execution, not speculatively.

---

## Execution Notes

User explicitly granted full execution autonomy. Inline execution chosen (no subagent dispatching) — fastest iteration for a long-running visual refactor where the same conversation context is valuable across phases.

Each task's commit is its own atomic git commit. Each phase's branch merge is `--no-ff` to preserve phase boundaries in history.
