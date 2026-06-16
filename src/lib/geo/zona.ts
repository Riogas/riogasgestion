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
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "puestoId" in parsed
      ) {
        return parsed as PuestoActual;
      }
      return null;
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !capasGeoJson.length) return { enZona: false };

  const pt = turfPoint([lng, lat]); // GeoJSON: [lng, lat]

  for (const zona of capasGeoJson) {
    if (zona?.type !== "FeatureCollection" || !Array.isArray(zona.features)) continue;

    for (const feature of zona.features) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (booleanPointInPolygon(pt, feature as any)) {
          const nombre =
            (feature.properties?.name as string | undefined) ??
            (feature.properties?.id as string | undefined);
          return { enZona: true, zona: nombre };
        }
      } catch {
        // malformed feature — skip
      }
    }
  }

  return { enZona: false };
}
