import { CODIGO_ALPHABET, CODIGO_REGEX, generarCodigo, formatearCanje, generarMomentos, inicioDiaMontevideo } from './sorteos.util';

describe('sorteos.util', () => {
  it('generarCodigo: 12 chars del alfabeto, sin ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigo();
      expect(c).toHaveLength(12);
      expect(c).toMatch(CODIGO_REGEX);
      expect(c).not.toMatch(/[ILO01]/);
    }
  });
  it('generarCodigo: sin colisiones en 10k', () => {
    const set = new Set(Array.from({ length: 10000 }, () => generarCodigo()));
    expect(set.size).toBe(10000);
  });
  it('formatearCanje agrega guion', () => {
    expect(formatearCanje('ABCD2345')).toBe('ABCD-2345');
  });
  it('generarMomentos: cantidad correcta, dentro del rango, ordenados', () => {
    const desde = new Date('2026-08-10T00:00:00Z');
    const hasta = new Date('2026-08-20T00:00:00Z');
    const m = generarMomentos(50, desde, hasta);
    expect(m).toHaveLength(50);
    for (let i = 0; i < m.length; i++) {
      expect(m[i].getTime()).toBeGreaterThanOrEqual(desde.getTime());
      expect(m[i].getTime()).toBeLessThanOrEqual(hasta.getTime());
      if (i > 0) expect(m[i].getTime()).toBeGreaterThanOrEqual(m[i - 1].getTime());
    }
  });
  it('inicioDiaMontevideo: 2026-08-05T02:30Z (23:30 del 4 en MVD) → inicio del 4 MVD', () => {
    const r = inicioDiaMontevideo(new Date('2026-08-05T02:30:00Z'));
    expect(r.toISOString()).toBe('2026-08-04T03:00:00.000Z'); // 00:00 MVD = 03:00Z
  });
  it('inicioDiaMontevideo: 2026-08-05T12:00Z (09:00 del 5 en MVD) → inicio del 5 MVD', () => {
    const r = inicioDiaMontevideo(new Date('2026-08-05T12:00:00Z'));
    expect(r.toISOString()).toBe('2026-08-05T03:00:00.000Z');
  });
});
