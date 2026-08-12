import { readFileSync } from 'fs';
import { join } from 'path';
import { busquedaNorm, normalizeDireccion } from './normalize-direccion';

const vectors = JSON.parse(
  readFileSync(join(__dirname, '../../../prisma/_fixtures/direccion_vectors.json'), 'utf8'),
);

describe('normalizeDireccion', () => {
  it.each(vectors)('normaliza %#', ({ in: input, out }) => {
    expect(normalizeDireccion(input)).toBe(out);
  });
});

// Espejo de upper(translate(...)) en sync_cliente_uni.py: misma salida o el
// contains de la búsqueda no matchea lo que dejó el sync en direccionBusq.
describe('busquedaNorm', () => {
  it.each([
    [
      'Cufré 2378, esq. Doctor Juan José de Amézaga y Doctor Domingo Aramburú, Montevideo',
      'CUFRE 2378, ESQ. DOCTOR JUAN JOSE DE AMEZAGA Y DOCTOR DOMINGO ARAMBURU, MONTEVIDEO',
    ],
    ['Ñangapiré 123 bis', 'NANGAPIRE 123 BIS'],
    ['Agraciada 4250, Apto 5', 'AGRACIADA 4250, APTO 5'],
    ['üöâçàèý', 'UOACAEY'],
  ])('normaliza %s', (input, out) => {
    expect(busquedaNorm(input)).toBe(out);
  });
});
