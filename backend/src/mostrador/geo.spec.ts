import { esCoordenadaUruguaya, latLngAUtm21S } from './geo';

/**
 * Los 4 pares de control de la spec (2026-08-14) salieron de clientes reales
 * comparados con pyproj (EPSG:4326 → EPSG:32721). Tolerancia exigida: 1 metro.
 * Si esto se rompe, DIRICAX/DIRICAY se escriben mal en el AS400 y el sistema
 * viejo ubica al cliente en cualquier lado.
 */
describe('latLngAUtm21S — pares de control contra pyproj (EPSG:32721)', () => {
  const casos: [number, number, number, number][] = [
    [-34.89889, -56.14753, 577885.87, 6137838.04],
    [-34.88257, -56.11148, 581195.72, 6139619.28],
    [-34.89024, -56.15816, 576922.7, 6138805.53],
    [-34.84994, -56.22157, 571163.23, 6143321.56],
  ];

  it.each(casos)('lat %s / lng %s → x %s, y %s (± 1 m)', (lat, lng, x, y) => {
    const r = latLngAUtm21S(lat, lng);
    expect(Math.abs(r.x - x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.y - y)).toBeLessThanOrEqual(1);
  });

  it('el northing del hemisferio sur nunca sale negativo', () => {
    expect(latLngAUtm21S(-34.9, -56.2).y).toBeGreaterThan(6_000_000);
  });

  it('rechaza coordenadas que no son números', () => {
    expect(() => latLngAUtm21S(Number.NaN, -56.2)).toThrow(RangeError);
    expect(() => latLngAUtm21S(-34.9, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('esCoordenadaUruguaya', () => {
  it('acepta puntos del país', () => {
    expect(esCoordenadaUruguaya(-34.89889, -56.14753)).toBe(true); // Montevideo
    expect(esCoordenadaUruguaya(-30.9, -55.55)).toBe(true); // Rivera
    expect(esCoordenadaUruguaya(-33.38, -53.52)).toBe(true); // Chuy
  });

  it('rechaza el 0,0, las coordenadas invertidas y los vecinos', () => {
    expect(esCoordenadaUruguaya(0, 0)).toBe(false);
    expect(esCoordenadaUruguaya(-56.14753, -34.89889)).toBe(false); // lat/lng dados vuelta
    expect(esCoordenadaUruguaya(-30.03, -51.2)).toBe(false); // Porto Alegre
    expect(esCoordenadaUruguaya(-31.42, -64.18)).toBe(false); // Córdoba (AR)
    expect(esCoordenadaUruguaya(Number.NaN, -56.1)).toBe(false);
  });
});
