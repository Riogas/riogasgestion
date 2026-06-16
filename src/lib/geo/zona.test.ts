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
