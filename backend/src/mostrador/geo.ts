/**
 * Conversión WGS84 → UTM 21S (EPSG:32721) hecha en casa.
 *
 * El AS400 guarda el par `DIRICAX`/`DIRICAY` en UTM 21S (easting/northing) y el
 * par `DIRCORX`/`DIRCORY` en grados — con los nombres invertidos: DIRCORX es la
 * LATITUD y DIRCORY la LONGITUD (verificado con datos reales, no tocar).
 *
 * Implementación propia a propósito: el deploy corre con `--frozen-lockfile`,
 * así que no se pueden sumar dependencias (proj4/utm). Es la serie clásica de
 * Snyder (Map Projections — A Working Manual, cap. 8) para Transverse Mercator
 * sobre el elipsoide; dentro de la zona el error es milimétrico (medido contra
 * los 4 pares de control de la spec: ≤ 5 mm).
 */

/** Semieje mayor WGS84. */
const A = 6378137;
/** Achatamiento WGS84. */
const F = 1 / 298.257223563;
/** Factor de escala UTM. */
const K0 = 0.9996;
/** Meridiano central de la zona 21 (−57°) en radianes. */
const LON0 = (-57 * Math.PI) / 180;
const FALSE_EASTING = 500000;
/** Hemisferio sur: todo el northing va corrido 10.000 km. */
const FALSE_NORTHING = 10000000;

const E2 = 2 * F - F * F;
const EP2 = E2 / (1 - E2);

/** Uruguay, con margen: cualquier cosa afuera es un pin mal puesto o un dato basura. */
const LAT_MIN = -35.1;
const LAT_MAX = -29.9;
const LNG_MIN = -58.6;
const LNG_MAX = -53.0;

export interface PuntoUtm {
  /** Easting (metros). Va a `DIRICAX`. */
  x: number;
  /** Northing (metros). Va a `DIRICAY`. */
  y: number;
}

function redondear(valor: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

/**
 * Latitud/longitud en grados → UTM 21S en metros.
 * Devuelve el resultado redondeado a 5 decimales porque las columnas del AS400
 * son `DEC(13,5)`: guardar más precisión de la que entra no sirve de nada.
 *
 * @throws RangeError si las coordenadas no son números válidos.
 */
export function latLngAUtm21S(lat: number, lng: number): PuntoUtm {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new RangeError('Latitud y longitud tienen que ser números válidos');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new RangeError(`Coordenada fuera del planeta: lat=${lat} lng=${lng}`);
  }

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const sen = Math.sin(latRad);
  const cos = Math.cos(latRad);
  const tan = Math.tan(latRad);

  const n = A / Math.sqrt(1 - E2 * sen * sen);
  const t = tan * tan;
  const c = EP2 * cos * cos;

  // Diferencia con el meridiano central, normalizada a (−π, π].
  let delta = lngRad - LON0;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const a = delta * cos;

  // Arco de meridiano desde el ecuador.
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * latRad -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * latRad) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * latRad));

  const x =
    K0 *
      n *
      (a +
        ((1 - t + c) * a ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120) +
    FALSE_EASTING;

  const y =
    K0 *
      (m +
        n *
          tan *
          ((a * a) / 2 +
            ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
            ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720)) +
    FALSE_NORTHING;

  return { x: redondear(x, 5), y: redondear(y, 5) };
}

/**
 * ¿El punto cae dentro del rectángulo que contiene a Uruguay?
 * Es un filtro grueso a propósito: sirve para cazar coordenadas invertidas,
 * en cero o pegadas en otro país antes de escribirlas en el AS400.
 */
export function esCoordenadaUruguaya(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX;
}
