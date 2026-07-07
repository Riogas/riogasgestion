import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeDireccion } from './normalize-direccion';

const vectors = JSON.parse(
  readFileSync(join(__dirname, '../../../prisma/_fixtures/direccion_vectors.json'), 'utf8'),
);

describe('normalizeDireccion', () => {
  it.each(vectors)('normaliza %#', ({ in: input, out }) => {
    expect(normalizeDireccion(input)).toBe(out);
  });
});
