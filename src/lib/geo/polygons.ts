// src/lib/geo/polygons.ts
// Coordinate-swap helpers for GeoJSON Polygon / MultiPolygon features.
// Both functions leave non-polygon features untouched.

import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
  Position,
} from "geojson";

type AnyFeatureCollection = FeatureCollection<Polygon | MultiPolygon>;

/**
 * Inverts every coordinate pair [a, b] → [b, a] inside Polygon / MultiPolygon features.
 * Used to convert [lat, lng] → [lng, lat] (GeoJSON standard).
 */
export function fixPolygonCoords(
  fc: AnyFeatureCollection,
): AnyFeatureCollection {
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
              ring.map((coord: Position) => [coord[1], coord[0]] as Position),
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
                ring.map((coord: Position) => [coord[1], coord[0]] as Position),
              ),
            ),
          },
        } as Feature<MultiPolygon>;
      }

      return feature as Feature<Polygon | MultiPolygon>;
    }),
  };
}

/**
 * Attempts to ensure every coordinate pair is [lng, lat] (GeoJSON standard)
 * using the heuristic: if |coord[0]| > 90, it's already a longitude.
 *
 * WARNING: For South American coordinates (Uruguay, Argentina, Brazil),
 * all longitudes have absolute value < 90°, so this heuristic CANNOT distinguish
 * [lng, lat] from [lat, lng] when both values are in range (-90, 90).
 * In that case this function always swaps — making it identical to `fixPolygonCoords`.
 *
 * Use `fixPolygonCoords` instead when you know the input is in [lat, lng] order.
 * This function is preserved for compatibility with callers that may receive
 * globally-diverse coordinate data where the heuristic is reliable.
 */
export function ensurePolygonsLngLat(
  fc: AnyFeatureCollection,
): AnyFeatureCollection {
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features))
    return fc;

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
      if (!geom || !("coordinates" in geom))
        return feature as Feature<Polygon | MultiPolygon>;

      if (geom.type === "Polygon") {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map((ring: Position[]) =>
              ring.map(fixCoord),
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
              polygon.map((ring: Position[]) => ring.map(fixCoord)),
            ),
          },
        } as Feature<MultiPolygon>;
      }

      return feature as Feature<Polygon | MultiPolygon>;
    }),
  };
}
