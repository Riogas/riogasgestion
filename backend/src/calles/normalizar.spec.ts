import { claveEsencial, normalizarCalle, normalizarLugar, sinTipoVia } from './normalizar';

/**
 * Paridad con `prisma/_normcalle.py` (_normcalle_test.py corre los mismos
 * casos): si esto diverge del batch de matching, el suggest no encuentra lo
 * que el matcher guardó.
 */
describe('normalizarCalle — casos reales de los dos mundos', () => {
  const casos: [string, string, boolean][] = [
    ['AVENIDA DIECIOCHO DE JULIO', '18 de Julio', false],
    ['AVENIDA DIECIOCHO DE JULIO', 'Avenida 18 de Julio', true],
    ['AVENIDA OCHO DE OCTUBRE', 'Avenida 8 de Octubre', true],
    ['BOULEVARD GENERAL ARTIGAS', 'Bulevar Gral. Artigas', true],
    ['BOULEVARD JOSE BATLLE Y ORDOÑEZ', 'Bulevar José Batlle y Ordóñez', true],
    ['AVENIDA DOCTOR LUIS ALBERTO DE HERRERA', 'Avenida Dr. Luis Alberto de Herrera', true],
    ['A LAS PIEDRAS,CNO. (PROGRESO)', 'Camino a Las Piedras', true],
    ['ÑANDUBAY (PROGRESO)', 'Ñandubay', true],
    ['TREINTA Y TRES', '33', true],
    ['VEINTICINCO DE MAYO', '25 de Mayo', true],
    ['CUFRE', 'Cufré', true],
    ['AVENIDA GENERAL RIVERA', 'Avenida General Fructuoso Rivera', false],
  ];

  it.each(casos)('[%s] vs [%s] -> igual=%s', (nomenclator, osm, esperado) => {
    expect(normalizarCalle(nomenclator) === normalizarCalle(osm)).toBe(esperado);
  });

  it('convierte números en palabras solo con contexto (inicio o fecha)', () => {
    expect(normalizarCalle('DIECIOCHO DE JULIO')).toBe('18 DE JULIO');
    expect(normalizarCalle('CALLE DIECIOCHO')).toBe('CALLE DIECIOCHO');
  });

  it('la clave sin tipo de vía empareja AVENIDA 18 DE JULIO con 18 DE JULIO', () => {
    expect(sinTipoVia(normalizarCalle('AVENIDA DIECIOCHO DE JULIO'))).toBe(
      sinTipoVia(normalizarCalle('18 de Julio')),
    );
  });

  it('normalizarLugar iguala Paysandú con PAYSANDU', () => {
    expect(normalizarLugar('Paysandú')).toBe(normalizarLugar('PAYSANDU'));
  });

  it('clave esencial: DOCTOR JOSE TERRA ↔ José L. Terra (paridad con _normcalle.py)', () => {
    expect(claveEsencial(normalizarCalle('DOCTOR JOSE TERRA'))).toBe(
      claveEsencial(normalizarCalle('José L. Terra')),
    );
    expect(claveEsencial(normalizarCalle('DOCTOR JOSE TERRA'))).toBe('JOSE TERRA');
    // rangos militares NO se descartan
    expect(claveEsencial(normalizarCalle('AVENIDA GENERAL FLORES'))).toBe('GENERAL FLORES');
  });
});
