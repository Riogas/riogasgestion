import { FichaCompleta, redactar } from './redaccion';

describe('redactar', () => {
  const ficha: FichaCompleta = {
    persona: { nombreOficial: 'Juan Pérez', estado: 'A', cedula: '12345678' },
    telefonos: [
      { id: 1, numero: '091111111', ultFecha: new Date('2026-01-01') },
      { id: 2, numero: '092222222', ultFecha: new Date('2026-03-01') },
      { id: 3, numero: '093333333', ultFecha: null },
    ],
    direcciones: [
      { id: 10, direccion: 'Av. Italia 2020', ultFecha: new Date('2026-02-01') },
      { id: 20, direccion: 'Bvar. España 100', ultFecha: new Date('2026-04-01') },
    ],
    hogares: [{ id: 100, etiqueta: 'Familia Pérez' }],
    observaciones: 'Cliente conflictivo',
  };

  it('CALL_CENTER ve la ficha completa (todos los teléfonos y direcciones)', () => {
    const redactada = redactar(ficha, 'CALL_CENTER', false);

    expect(redactada.scope).toBe('COMPLETA');
    expect(redactada.nombre).toBe('Juan Pérez');
    expect(redactada.estado).toBe('A');
    expect(redactada.cedula).toBe('12345678');
    expect(redactada.telefono).toEqual(ficha.telefonos);
    expect(redactada.direccion).toEqual(ficha.direcciones);
  });

  it('DISTRIBUIDOR sin afiliación solo ve el nombre', () => {
    const redactada = redactar(ficha, 'DISTRIBUIDOR', false);

    expect(redactada).toEqual({ nombre: 'Juan Pérez', scope: 'MINIMA' });
  });

  it('DISTRIBUIDOR afiliado ve nombre/estado/cédula + el último teléfono y la última dirección', () => {
    const redactada = redactar(ficha, 'DISTRIBUIDOR', true);

    expect(redactada.scope).toBe('AFILIADA');
    expect(redactada.nombre).toBe('Juan Pérez');
    expect(redactada.estado).toBe('A');
    expect(redactada.cedula).toBe('12345678');
    expect(redactada.telefono).toEqual(ficha.telefonos[1]); // ultFecha más reciente (marzo)
    expect(redactada.direccion).toEqual(ficha.direcciones[1]); // ultFecha más reciente (abril)
  });

  it('DISTRIBUIDOR afiliado sin teléfonos/direcciones no revienta (queda sin valor)', () => {
    const fichaVacia: FichaCompleta = {
      persona: { nombreOficial: 'Sin Datos' },
      telefonos: [],
      direcciones: [],
      hogares: [],
    };

    const redactada = redactar(fichaVacia, 'DISTRIBUIDOR', true);

    expect(redactada.telefono).toBeUndefined();
    expect(redactada.direccion).toBeUndefined();
  });
});
