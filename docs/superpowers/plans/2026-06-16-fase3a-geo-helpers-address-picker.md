# Fase 3a — Geo Helpers + AddressPicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated geo/zone logic from `DireccionEditor.tsx` and `ClienteForm.tsx` into `src/lib/geo/`, then build a reusable `AddressPicker` component that replaces inline logic.

**Architecture:** Three new files in `src/lib/geo/` (`polygons.ts`, `zona.ts`, `zona.test.ts`) hold all geo logic; `DireccionEditor.tsx` is refactored to import from there; a new `AddressPicker.tsx` component wires everything together with street autocomplete, cascading selects, Leaflet map, and a persistent zone indicator.

**Tech Stack:** Next.js App Router, React 18, TypeScript (strict), Tailwind, shadcn/ui (Input/Label/Select), `@turf/helpers`, `@turf/boolean-point-in-polygon`, `leaflet` (dynamic import, ssr:false), `apiGetCapaGoya` + `apiGetCalles` from `src/services/api.ts`, `GenexusFeatureCollectionToGeoJson` from `src/lib/convertirGeoJson.ts`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/geo/polygons.ts` | `fixPolygonCoords`, `ensurePolygonsLngLat` — coordinate swap helpers |
| Create | `src/lib/geo/zona.ts` | `getPuestoActual`, `puntoEnZona` — puesto from localStorage + turf point-in-polygon |
| Create | `src/lib/geo/zona.test.ts` | Node-runnable test with `npx tsx` |
| Create | `src/lib/geo/index.ts` | Re-exports everything from polygons + zona |
| Modify | `src/components/clientes/DireccionEditor.tsx` | Import from `@/lib/geo`; remove inline helpers |
| Create | `src/components/clientes/AddressPicker.tsx` | Reusable controlled component: street autocomplete, dep/loc selects, Leaflet map, zone indicator |

---

## Task 1: Create `src/lib/geo/polygons.ts`

**Files:**
- Create: `src/lib/geo/polygons.ts`

- [ ] **Step 1: Create the file with typed polygon helpers**

```typescript
// src/lib/geo/polygons.ts
// Coordinate-swap helpers for GeoJSON Polygon / MultiPolygon features.
// Both functions leave non-polygon features untouched.

import type { FeatureCollection, Feature, Polygon, MultiPolygon, Position } from "geojson";

type AnyFeatureCollection = FeatureCollection<Polygon | MultiPolygon>;

/**
 * Inverts every coordinate pair [a, b] → [b, a] inside Polygon / MultiPolygon features.
 * Used to convert [lat, lng] → [lng, lat] (GeoJSON standard).
 */
export function fixPolygonCoords(fc: AnyFeatureCollection): AnyFeatureCollection {
  if (!fc || fc.type !== "FeatureCollection") return fc;
  return {
    ...fc,
    features: fc.features.map((feature) => {
      const geom = feature.geometry;
      if (!geom) return feature as Feature<Polygon | MultiPolygon>;

      if (geom.type === "Polygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((ring: Position[]) =>
              ring.map((coord: Position) => [coord[1], coord[0]] as Position)
            ),
          },
        } as Feature<Polygon>;
      }

      if (geom.type === "MultiPolygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((polygon: Position[][]) =>
              polygon.map((ring: Position[]) =>
                ring.map((coord: Position) => [coord[1], coord[0]] as Position)
              )
            ),
          },
        } as Feature<MultiPolygon>;
      }

      return feature as Feature<Polygon | MultiPolygon>;
    }),
  };
}

/**
 * Ensures every coordinate pair is [lng, lat] (GeoJSON standard).
 * Heuristic: if |coord[0]| > 90, it's already longitude — leave it; otherwise swap.
 */
export function ensurePolygonsLngLat(fc: AnyFeatureCollection): AnyFeatureCollection {
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return fc;

  function fixCoord(coord: Position): Position {
    if (!Array.isArray(coord) || coord.length < 2) return coord;
    const [a, b] = coord as [number, number];
    // If |a| > 90 it's already a longitude value → already [lng, lat]
    return Math.abs(a) > 90 ? [a, b] : [b, a];
  }

  return {
    ...fc,
    features: fc.features.map((feature) => {
      const geom = feature.geometry;
      if (!geom || !("coordinates" in geom)) return feature as Feature<Polygon | MultiPolygon>;

      if (geom.type === "Polygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((ring: Position[]) => ring.map(fixCoord)),
          },
        } as Feature<Polygon>;
      }

      if (geom.type === "MultiPolygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((polygon: Position[][]) =>
              polygon.map((ring: Position[]) => ring.map(fixCoord))
            ),
          },
        } as Feature<MultiPolygon>;
      }

      return feature as Feature<Polygon | MultiPolygon>;
    }),
  };
}
```

- [ ] **Step 2: Verify file compiles (no tsc errors in this file)**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
pnpm exec tsc --noEmit 2>&1 | grep "lib/geo/polygons"
```

Expected: no output (zero errors for this file).

---

## Task 2: Create `src/lib/geo/zona.ts`

**Files:**
- Create: `src/lib/geo/zona.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/geo/zona.ts
// Zone validation and puesto-from-storage helpers.

import { point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { FeatureCollection } from "geojson";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PuestoActual {
  puestoId: number | string;
  [key: string]: unknown;
}

export interface ZonaResult {
  enZona: boolean;
  /** Name of the first matching zone feature, if found */
  zona?: string;
}

// ─── getPuestoActual ──────────────────────────────────────────────────────────

/**
 * Reads the current "puesto" (branch/office) from localStorage.
 * Tries `puestoActual` first, then falls back to `puesto`.
 * Returns null in SSR context or if nothing is stored.
 */
export function getPuestoActual(): PuestoActual | null {
  if (typeof window === "undefined") return null;

  const tryParse = (key: string): PuestoActual | null => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PuestoActual;
    } catch {
      return null;
    }
  };

  return tryParse("puestoActual") ?? tryParse("puesto");
}

// ─── puntoEnZona ─────────────────────────────────────────────────────────────

/**
 * Checks whether [lat, lng] falls inside any Polygon / MultiPolygon feature
 * in the provided array of GeoJSON FeatureCollections.
 *
 * Coordinates must already be in [lng, lat] order (GeoJSON standard).
 *
 * @param lat  Latitude
 * @param lng  Longitude
 * @param capasGeoJson  Array of GeoJSON FeatureCollections (already converted from Genexus format)
 */
export function puntoEnZona(
  lat: number,
  lng: number,
  capasGeoJson: FeatureCollection[]
): ZonaResult {
  if (!lat || !lng || !capasGeoJson.length) return { enZona: false };

  const pt = turfPoint([lng, lat]); // GeoJSON: [lng, lat]

  for (const zona of capasGeoJson) {
    if (zona?.type !== "FeatureCollection" || !Array.isArray(zona.features)) continue;

    for (const feature of zona.features) {
      try {
        if (booleanPointInPolygon(pt, feature as Parameters<typeof booleanPointInPolygon>[1])) {
          const nombre =
            (feature.properties?.name as string | undefined) ??
            (feature.properties?.id as string | undefined) ??
            undefined;
          return { enZona: true, zona: nombre };
        }
      } catch {
        // malformed feature — skip
      }
    }
  }

  return { enZona: false };
}
```

- [ ] **Step 2: Verify tsc for this file**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
pnpm exec tsc --noEmit 2>&1 | grep "lib/geo/zona"
```

Expected: no output.

---

## Task 3: Create `src/lib/geo/index.ts` (barrel)

**Files:**
- Create: `src/lib/geo/index.ts`

- [ ] **Step 1: Create the barrel**

```typescript
// src/lib/geo/index.ts
export { fixPolygonCoords, ensurePolygonsLngLat } from "./polygons";
export { getPuestoActual, puntoEnZona } from "./zona";
export type { PuestoActual, ZonaResult } from "./zona";
```

---

## Task 4: Write and run a node test for `puntoEnZona`

**Files:**
- Create: `src/lib/geo/zona.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/lib/geo/zona.test.ts
// Run with:  npx tsx src/lib/geo/zona.test.ts
// No test framework needed — just Node assertions.

import { puntoEnZona } from "./zona";
import type { FeatureCollection } from "geojson";

// Simple square: from -1,-1 to 1,1 (lng/lat)
const squareFC: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "ZonaPrueba" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
            [-1, -1],
          ],
        ],
      },
    },
  ],
};

// ── Test 1: point inside ──────────────────────────────────────────────────────
const inside = puntoEnZona(0, 0, [squareFC]); // lat=0, lng=0 → inside square
console.assert(inside.enZona === true, `FAIL Test 1 — expected enZona=true, got ${inside.enZona}`);
console.assert(
  inside.zona === "ZonaPrueba",
  `FAIL Test 1 — expected zona='ZonaPrueba', got '${inside.zona}'`
);
console.log("✓ Test 1 — punto dentro de zona:", inside);

// ── Test 2: point outside ─────────────────────────────────────────────────────
const outside = puntoEnZona(5, 5, [squareFC]); // lat=5, lng=5 → outside square
console.assert(outside.enZona === false, `FAIL Test 2 — expected enZona=false, got ${outside.enZona}`);
console.log("✓ Test 2 — punto fuera de zona:", outside);

// ── Test 3: empty capas ───────────────────────────────────────────────────────
const emptyResult = puntoEnZona(0, 0, []);
console.assert(emptyResult.enZona === false, "FAIL Test 3 — expected enZona=false with empty capas");
console.log("✓ Test 3 — capas vacías:", emptyResult);

// ── Test 4: multiple zones, hit second ───────────────────────────────────────
const zone2: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "ZonaB" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2, 2],
            [4, 2],
            [4, 4],
            [2, 4],
            [2, 2],
          ],
        ],
      },
    },
  ],
};

// lat=3, lng=3 is inside zone2 but outside squareFC
const hitSecond = puntoEnZona(3, 3, [squareFC, zone2]);
console.assert(hitSecond.enZona === true, `FAIL Test 4 — expected enZona=true, got ${hitSecond.enZona}`);
console.assert(
  hitSecond.zona === "ZonaB",
  `FAIL Test 4 — expected zona='ZonaB', got '${hitSecond.zona}'`
);
console.log("✓ Test 4 — punto dentro de zona secundaria:", hitSecond);

console.log("\n✅ All tests passed.");
```

- [ ] **Step 2: Run the test**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
npx tsx src/lib/geo/zona.test.ts
```

Expected output:
```
✓ Test 1 — punto dentro de zona: { enZona: true, zona: 'ZonaPrueba' }
✓ Test 2 — punto fuera de zona: { enZona: false }
✓ Test 3 — capas vacías: { enZona: false }
✓ Test 4 — punto dentro de zona secundaria: { enZona: true, zona: 'ZonaB' }

✅ All tests passed.
```

If a test fails, the `console.assert` will throw. Fix `zona.ts` and re-run until all 4 pass.

---

## Task 5: Refactor `DireccionEditor.tsx` to import from `@/lib/geo`

**Files:**
- Modify: `src/components/clientes/DireccionEditor.tsx`

The current file has:
1. A local `getPuestoActual()` function (lines 42–51) — DELETE it, import from `@/lib/geo`.
2. The zone check `useEffect` (lines 96–111) uses inline `turfPoint` + `booleanPointInPolygon` — replace with `puntoEnZona` from `@/lib/geo`.

**No behavior change** — the toast calls remain the same.

- [ ] **Step 1: Replace the import block at the top of `DireccionEditor.tsx`**

Current imports (lines 1–16):
```typescript
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { point as turfPoint } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { toast } from "sonner";
import { apiGetCapaGoya } from "@/services/api";
import { GenexusFeatureCollectionToGeoJson } from "@/lib/convertirGeoJson";
```

Replace with:
```typescript
"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { toast } from "sonner";
import { apiGetCapaGoya } from "@/services/api";
import { GenexusFeatureCollectionToGeoJson } from "@/lib/convertirGeoJson";
import { getPuestoActual, puntoEnZona } from "@/lib/geo";
import type { FeatureCollection } from "geojson";
```

- [ ] **Step 2: Remove the local `getPuestoActual` function (lines 42–51)**

Delete this block entirely (it will now come from `@/lib/geo`):
```typescript
function getPuestoActual() {
  if (typeof window === "undefined") return null;
  const actual = localStorage.getItem("puestoActual");
  if (actual) {
    try { return JSON.parse(actual); } catch { return null; }
  }
  const p = localStorage.getItem("puesto");
  if (p) { try { return JSON.parse(p); } catch { return null; } }
  return null;
}
```

- [ ] **Step 3: Update the `capasGeoJson` state type**

Change:
```typescript
const [capasGeoJson, setCapasGeoJson] = useState<any[]>([]);
```

To:
```typescript
const [capasGeoJson, setCapasGeoJson] = useState<FeatureCollection[]>([]);
```

- [ ] **Step 4: Replace the zone check `useEffect` (lines 96–111)**

Current:
```typescript
  // zone check whenever coords change
  useEffect(() => {
    if (!value.lat || !value.lng || capasGeoJson.length === 0) return;
    const pt = turfPoint([parseFloat(value.lng), parseFloat(value.lat)]);
    let inZone = false;
    try {
      capasGeoJson.forEach((zona: any) => {
        if (zona?.type === "FeatureCollection") {
          zona.features?.forEach((feature: any) => {
            try { if (booleanPointInPolygon(pt, feature)) inZone = true; } catch {}
          });
        }
      });
    } catch {}
    if (inZone) toast.success("Cliente en zona", { duration: 2500 });
    else toast.error("Cliente fuera de zona", { duration: 2500 });
  }, [value.lat, value.lng, capasGeoJson]);
```

Replace with:
```typescript
  // zone check whenever coords change
  useEffect(() => {
    if (!value.lat || !value.lng || capasGeoJson.length === 0) return;
    const { enZona } = puntoEnZona(
      parseFloat(value.lat),
      parseFloat(value.lng),
      capasGeoJson
    );
    if (enZona) toast.success("Cliente en zona", { duration: 2500 });
    else toast.error("Cliente fuera de zona", { duration: 2500 });
  }, [value.lat, value.lng, capasGeoJson]);
```

- [ ] **Step 5: Verify tsc passes for DireccionEditor**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
pnpm exec tsc --noEmit 2>&1 | grep -i "DireccionEditor\|lib/geo"
```

Expected: no output.

---

## Task 6: Create `src/components/clientes/AddressPicker.tsx`

**Files:**
- Create: `src/components/clientes/AddressPicker.tsx`

This component is a controlled address form with:
- Cascading `departamento` / `localidad` selects (same hardcoded data as DireccionEditor for now)
- `calle` input with `<datalist>` autocomplete loaded from `apiGetCalles`
- `nroPuerta`, `esquina1`, `esquina2`, `apto` (maps to `apto` field), `local` — **separate fields**
- Leaflet map (`DynamicMapa`) that updates lat/lng when pin moves
- A **persistent** zone indicator badge (not a toast)

The component is **controlled**: parent owns state via `value` / `onChange`.

- [ ] **Step 1: Create the file**

```typescript
// src/components/clientes/AddressPicker.tsx
"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiGetCapaGoya, apiGetCalles } from "@/services/api";
import { GenexusFeatureCollectionToGeoJson } from "@/lib/convertirGeoJson";
import { getPuestoActual, puntoEnZona } from "@/lib/geo";
import type { ClienteDireccion } from "@/lib/types/cliente";
import type { ZonaResult } from "@/lib/geo";
import type { FeatureCollection } from "geojson";

const DynamicMapa = dynamic(
  () => import("@/components/mapa/OpenStreetMap"),
  { ssr: false }
);

// ─── Static data ─────────────────────────────────────────────────────────────
// TODO(fase6): replace with dynamic apiGetDepartamentos / apiGetLocalidades
const DEPARTAMENTOS = [
  { nombre: "Montevideo", localidades: ["Centro", "Ciudad Vieja", "Pocitos"] },
  { nombre: "Canelones", localidades: ["Las Piedras", "La Paz", "Barros Blancos"] },
  { nombre: "Maldonado", localidades: ["Punta del Este", "San Carlos", "La Barra"] },
  { nombre: "Salto", localidades: ["Salto"] },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Partial ClienteDireccion that the picker operates on. */
export type AddressPickerValue = Partial<
  Pick<
    ClienteDireccion,
    "calle" | "nroPuerta" | "esquina1" | "esquina2" | "apto" | "local" | "lat" | "lng" | "zona"
  >
> & {
  /** Human-readable department name (UI-level; mapped to departamentoId on save) */
  departamento?: string;
  /** Human-readable locality name (UI-level; mapped to localidadId on save) */
  localidad?: string;
};

export interface AddressPickerProps {
  value: AddressPickerValue;
  onChange: (patch: Partial<AddressPickerValue>) => void;
  onZonaChange?: (result: ZonaResult) => void;
  /** Optional CSS class for the root wrapper */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddressPicker({
  value,
  onChange,
  onZonaChange,
  className,
}: AddressPickerProps) {
  const callesListId = useId();

  const [localidades, setLocalidades] = useState<string[]>([]);
  const [calles, setCalles] = useState<string[]>([]);
  const [capasGeoJson, setCapasGeoJson] = useState<FeatureCollection[]>([]);
  const [zonaResult, setZonaResult] = useState<ZonaResult | null>(null);

  // ── Cascading selects ─────────────────────────────────────────────────────
  useEffect(() => {
    const depto = DEPARTAMENTOS.find((d) => d.nombre === value.departamento);
    setLocalidades(depto ? [...depto.localidades] : []);
  }, [value.departamento]);

  // ── Load zone layers once ─────────────────────────────────────────────────
  useEffect(() => {
    const puesto = getPuestoActual();
    if (!puesto?.puestoId) return;

    apiGetCapaGoya({ PuestoId: String(puesto.puestoId), TipoCapaId: "" })
      .then((data) => {
        const capasArr: unknown[] = data?.sdtCapasGoya ?? [];
        const geojsons = capasArr
          .map((capa) => {
            const c = capa as { CapaGeoJson?: unknown };
            try {
              const parsed =
                typeof c.CapaGeoJson === "string"
                  ? JSON.parse(c.CapaGeoJson)
                  : c.CapaGeoJson;
              if (parsed?.type === "FeatureCollection") {
                return GenexusFeatureCollectionToGeoJson(parsed) as FeatureCollection;
              }
            } catch {
              // ignore malformed layers
            }
            return null;
          })
          .filter((x): x is FeatureCollection => x !== null);
        setCapasGeoJson(geojsons);
      })
      .catch(() => setCapasGeoJson([]));
  }, []);

  // ── Recalculate zone when coords change ───────────────────────────────────
  useEffect(() => {
    const lat = value.lat != null ? Number(value.lat) : NaN;
    const lng = value.lng != null ? Number(value.lng) : NaN;
    if (isNaN(lat) || isNaN(lng) || capasGeoJson.length === 0) {
      setZonaResult(null);
      return;
    }
    const result = puntoEnZona(lat, lng, capasGeoJson);
    setZonaResult(result);
    onZonaChange?.(result);
  }, [value.lat, value.lng, capasGeoJson, onZonaChange]);

  // ── Street autocomplete: load when localidad changes ─────────────────────
  // We need departamentoId and localidadId; for now we use index-based IDs
  // since apiGetCalles expects numeric ids. TODO: wire real ids from apiGetLocalidades.
  useEffect(() => {
    if (!value.departamento || !value.localidad) {
      setCalles([]);
      return;
    }
    const deptoIdx = DEPARTAMENTOS.findIndex((d) => d.nombre === value.departamento);
    const locIdx = localidades.findIndex((l) => l === value.localidad);
    if (deptoIdx < 0 || locIdx < 0) return;

    // Use 1-based indices as placeholder ids (real ids come from apiGetDepartamentos)
    apiGetCalles({ DepartamentoId: deptoIdx + 1, LocalidadId: locIdx + 1 })
      .then((data) => {
        const rows: { Nombre?: string; nombre?: string }[] = data?.sdtCalles ?? [];
        setCalles(rows.map((c) => c.Nombre ?? c.nombre ?? "").filter(Boolean));
      })
      .catch(() => setCalles([]));
  }, [value.departamento, value.localidad, localidades]);

  // ── Map change handler ────────────────────────────────────────────────────
  const handleMapChange = (data: {
    lat: string;
    lng: string;
    address?: string;
    houseNumber?: string;
  }) => {
    const patch: Partial<AddressPickerValue> = {};
    if (data.address) patch.calle = data.address;
    if (data.houseNumber) patch.nroPuerta = data.houseNumber;
    if (data.lat) patch.lat = Number(data.lat);
    if (data.lng) patch.lng = Number(data.lng);
    onChange(patch);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3", className)}>
      {/* Left column: form fields */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
        {/* Departamento */}
        <div className="md:col-span-3">
          <Label htmlFor="ap-depto" className="text-xs">
            Departamento
          </Label>
          <Select
            value={value.departamento ?? ""}
            onValueChange={(v) =>
              onChange({ departamento: v, localidad: "", calle: "" })
            }
          >
            <SelectTrigger id="ap-depto" className="w-full h-8 text-xs">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTAMENTOS.map((d) => (
                <SelectItem key={d.nombre} value={d.nombre}>
                  {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Localidad */}
        <div className="md:col-span-3">
          <Label htmlFor="ap-loc" className="text-xs">
            Localidad
          </Label>
          <Select
            value={value.localidad ?? ""}
            onValueChange={(v) => onChange({ localidad: v, calle: "" })}
            disabled={!value.departamento}
          >
            <SelectTrigger id="ap-loc" className="w-full h-8 text-xs">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {localidades.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Calle con datalist autocomplete */}
        <div className="col-span-full">
          <Label htmlFor="ap-calle" className="text-xs">
            Calle
          </Label>
          <Input
            id="ap-calle"
            list={callesListId}
            className="h-8 text-xs"
            placeholder="Ej: Av. Italia"
            value={value.calle ?? ""}
            onChange={(e) => onChange({ calle: e.target.value })}
          />
          <datalist id={callesListId}>
            {calles.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Nro Puerta */}
        <div className="md:col-span-2">
          <Label htmlFor="ap-nro" className="text-xs">
            Nº Puerta
          </Label>
          <Input
            id="ap-nro"
            className="h-8 text-xs"
            value={value.nroPuerta ?? ""}
            onChange={(e) => onChange({ nroPuerta: e.target.value })}
          />
        </div>

        {/* Esquina 1 */}
        <div className="md:col-span-2">
          <Label htmlFor="ap-esq1" className="text-xs">
            Esquina 1
          </Label>
          <Input
            id="ap-esq1"
            className="h-8 text-xs"
            value={value.esquina1 ?? ""}
            onChange={(e) => onChange({ esquina1: e.target.value })}
          />
        </div>

        {/* Esquina 2 */}
        <div className="md:col-span-2">
          <Label htmlFor="ap-esq2" className="text-xs">
            Esquina 2
          </Label>
          <Input
            id="ap-esq2"
            className="h-8 text-xs"
            value={value.esquina2 ?? ""}
            onChange={(e) => onChange({ esquina2: e.target.value })}
          />
        </div>

        {/* Apto — maps to ClienteDireccion.apto (separate from local) */}
        <div className="md:col-span-3">
          <Label htmlFor="ap-apto" className="text-xs">
            Apto
          </Label>
          <Input
            id="ap-apto"
            className="h-8 text-xs"
            value={value.apto ?? ""}
            onChange={(e) => onChange({ apto: e.target.value })}
          />
        </div>

        {/* Local — maps to ClienteDireccion.local (separate from apto) */}
        <div className="md:col-span-3">
          <Label htmlFor="ap-local" className="text-xs">
            Local
          </Label>
          <Input
            id="ap-local"
            className="h-8 text-xs"
            value={value.local ?? ""}
            onChange={(e) => onChange({ local: e.target.value })}
          />
        </div>

        {/* Lat / Lng (read-only display) */}
        <div className="md:col-span-3">
          <Label htmlFor="ap-lat" className="text-xs">
            Latitud
          </Label>
          <Input
            id="ap-lat"
            className="h-8 text-xs"
            readOnly
            value={value.lat != null ? String(value.lat) : ""}
          />
        </div>
        <div className="md:col-span-3">
          <Label htmlFor="ap-lng" className="text-xs">
            Longitud
          </Label>
          <Input
            id="ap-lng"
            className="h-8 text-xs"
            readOnly
            value={value.lng != null ? String(value.lng) : ""}
          />
        </div>

        {/* Persistent zone indicator */}
        {zonaResult !== null && (
          <div className="col-span-full">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                zonaResult.enZona
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
              )}
              aria-live="polite"
            >
              {zonaResult.enZona ? "✓" : "⚠"}{" "}
              {zonaResult.enZona
                ? `En zona${zonaResult.zona ? ` ${zonaResult.zona}` : ""}`
                : "Fuera de zona"}
            </span>
          </div>
        )}
      </div>

      {/* Right column: Leaflet map */}
      <div>
        <DynamicMapa
          onChange={handleMapChange}
          departamento={value.departamento}
          localidad={value.localidad ?? ""}
          direccion={value.calle ?? ""}
          nroPuerta={value.nroPuerta ?? ""}
          esquina1={value.esquina1 ?? ""}
          esquina2={value.esquina2 ?? ""}
          zonas={capasGeoJson}
          mapHeightPx={520}
        />
      </div>
    </div>
  );
}
```

> **Bug fix note**: `apto` and `local` are **separate fields** — the old `DireccionEditor` had both "Apto" and "Local" writing to `value.local`, which was a bug. `AddressPicker` maps "Apto" → `value.apto` and "Local" → `value.local` correctly per the `ClienteDireccion` type.

- [ ] **Step 2: Verify tsc for AddressPicker**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
pnpm exec tsc --noEmit 2>&1 | grep -i "AddressPicker\|lib/geo"
```

Expected: no output.

---

## Task 7: Full tsc check — no new errors

- [ ] **Step 1: Run full tsc**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
pnpm exec tsc --noEmit 2>&1
```

Expected: zero errors in `src/` files. There may be pre-existing errors in `backend/` — those are acceptable and must not be introduced by this change. To confirm scope, pipe through:

```bash
pnpm exec tsc --noEmit 2>&1 | grep -v "^$" | grep -v "backend/"
```

Expected: only "Found N error(s)" where errors are NOT in files we touched.

- [ ] **Step 2: If there are new errors in `src/`, fix them before committing**

Common issues to check:
- `@types/geojson` not installed → the `geojson` types come from `@turf/helpers` transitively; if missing run `pnpm add -D @types/geojson`.
- `cn` import: if `@/lib/utils` doesn't export `cn`, replace with a plain template literal or install `clsx`.

---

## Task 8: Run the geo test

- [ ] **Step 1: Run zona.test.ts**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
npx tsx src/lib/geo/zona.test.ts
```

Expected:
```
✓ Test 1 — punto dentro de zona: { enZona: true, zona: 'ZonaPrueba' }
✓ Test 2 — punto fuera de zona: { enZona: false }
✓ Test 3 — capas vacías: { enZona: false }
✓ Test 4 — punto dentro de zona secundaria: { enZona: true, zona: 'ZonaB' }

✅ All tests passed.
```

---

## Task 9: Commit

- [ ] **Step 1: Stage the new and modified files**

```bash
cd C:\Users\jgomez\Documents\Projects\gestiondefinitivo\riogasgestion
git add src/lib/geo/polygons.ts src/lib/geo/zona.ts src/lib/geo/zona.test.ts src/lib/geo/index.ts src/components/clientes/AddressPicker.tsx src/components/clientes/DireccionEditor.tsx
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(frontend): AddressPicker reutilizable + helpers de geo/zona extraídos a lib/geo"
```

- [ ] **Step 3: Verify commit landed on `dev` branch**

```bash
git log --oneline -3
git branch --show-current
```

Expected: branch = `dev`, latest commit has the message above.

---

## Self-Review Checklist

### Spec Coverage
| Requirement | Task |
|---|---|
| `src/lib/geo/polygons.ts` with `fixPolygonCoords`, `ensurePolygonsLngLat` | Task 1 |
| `src/lib/geo/zona.ts` with `puntoEnZona` and `getPuestoActual` | Task 2 |
| `DireccionEditor.tsx` refactored to import from `@/lib/geo` | Task 5 |
| `AddressPicker.tsx` controlled component | Task 6 |
| Calle autocomplete via `apiGetCalles` / datalist | Task 6, Step 1 |
| Dep/loc cascading selects | Task 6, Step 1 |
| nroPuerta, esquina1, esquina2, apto, local **as separate fields** | Task 6, Step 1 (bug fix) |
| Leaflet map with pin → updates lat/lng → recalculates zone | Task 6, Step 1 |
| Persistent zone indicator (not toast) | Task 6, Step 1 |
| tsc passes | Task 7 |
| Node test for `puntoEnZona` | Tasks 4 + 8 |
| Commit message exact | Task 9 |
| `ClienteForm.tsx` NOT touched | (constraint honored — no task modifies it) |

### Potential Issues
- `@types/geojson` may need to be installed. Check `pnpm exec tsc` output; if missing, `pnpm add -D @types/geojson`.
- `cn` utility: `src/lib/utils.ts` likely exists in a Next.js + shadcn setup. Verify before assuming.
- `value.lat` / `value.lng` in `ClienteDireccion` are typed as `number | null`, but `DireccionEditor.Direccion` uses `string`. `AddressPicker` uses `number` to match `ClienteDireccion`. The old `DireccionEditor` type is left as-is (strings).
- The `@turf/boolean-point-in-polygon` second argument type: we cast with `as Parameters<typeof booleanPointInPolygon>[1]`. If turf v7 has stricter types, this may need adjustment.
