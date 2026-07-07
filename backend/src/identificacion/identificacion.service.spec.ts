import { PrismaService } from '../prisma/prisma.service';
import { PersonasService, Persona360 } from '../personas/personas.service';
import { CoberturaService } from '../cobertura/cobertura.service';
import { FakePrismaService } from '../personas/__tests__/prisma-fake';
import { IdentificacionService } from './identificacion.service';

describe('IdentificacionService', () => {
  let fake: FakePrismaService;
  let personas: { find360: jest.Mock };
  let cobertura: { tieneAfiliacion: jest.Mock };
  let service: IdentificacionService;

  const ficha360Base: Persona360 = {
    persona: {
      id: 1, nombreOficial: 'Juan Pérez', estado: 'A', cedula: '12345678',
    } as Persona360['persona'],
    registros: [],
    telefonos: [{ id: 100, numero: '091111111', ultFecha: new Date('2026-01-01') } as any],
    direcciones: [{ id: 1000, direccion: 'Av. Italia 2020', ultFecha: new Date('2026-01-01') } as any],
    hogares: [],
  };

  beforeEach(() => {
    fake = new FakePrismaService();
    fake.personas = [{ id: 1, nombreOficial: 'Juan Pérez', cedula: '12345678', estado: 'A' }];
    fake.clienteUnis = [
      {
        id: 10,
        personaId: 1,
        nombre: 'Juan Pérez',
        telefonos: [{
          id: 100, clienteId: 10, numero: '091111111', estado: 'A', ultFecha: new Date('2026-01-01'),
        }],
        direcciones: [],
      },
    ];

    personas = { find360: jest.fn() };
    cobertura = { tieneAfiliacion: jest.fn() };

    service = new IdentificacionService(
      fake as unknown as PrismaService,
      personas as unknown as PersonasService,
      cobertura as unknown as CoberturaService,
    );
  });

  it('matchea por teléfono exacto y arma la ficha COMPLETA para call center', async () => {
    personas.find360.mockResolvedValue(ficha360Base);

    const resultado = await service.identificar({
      identificador: '091111111', tipo: 'TELEFONO', rol: 'CALL_CENTER',
    });

    expect(resultado.resultado).toBe('MATCH');
    expect(resultado.ficha?.scope).toBe('COMPLETA');
    expect(resultado.ficha?.nombre).toBe('Juan Pérez');
    expect(cobertura.tieneAfiliacion).not.toHaveBeenCalled();
  });

  it('distribuidor sin afiliación recibe ficha MINIMA (solo nombre)', async () => {
    personas.find360.mockResolvedValue(ficha360Base);
    cobertura.tieneAfiliacion.mockResolvedValue(false);

    const resultado = await service.identificar({
      identificador: '12345678', tipo: 'CEDULA', rol: 'DISTRIBUIDOR', empresaFleteraId: 100,
    });

    expect(resultado.resultado).toBe('MATCH');
    expect(resultado.ficha).toEqual({ nombre: 'Juan Pérez', scope: 'MINIMA' });
    expect(resultado.requiereAltaDireccion).toBeUndefined();
  });

  it('distribuidor afiliado sin dirección requiere alta de dirección', async () => {
    personas.find360.mockResolvedValue({ ...ficha360Base, direcciones: [] });
    cobertura.tieneAfiliacion.mockResolvedValue(true);

    const resultado = await service.identificar({
      identificador: '12345678', tipo: 'CEDULA', rol: 'DISTRIBUIDOR', empresaFleteraId: 100,
    });

    expect(resultado.resultado).toBe('MATCH');
    expect(resultado.ficha?.scope).toBe('AFILIADA');
    expect(resultado.ficha?.direccion).toBeUndefined();
    expect(resultado.requiereAltaDireccion).toBe(true);
    expect(cobertura.tieneAfiliacion).toHaveBeenCalledWith(1, 100);
  });

  it('distribuidor afiliado con dirección no requiere alta', async () => {
    personas.find360.mockResolvedValue(ficha360Base);
    cobertura.tieneAfiliacion.mockResolvedValue(true);

    const resultado = await service.identificar({
      identificador: '12345678', tipo: 'CEDULA', rol: 'DISTRIBUIDOR', empresaFleteraId: 100,
    });

    expect(resultado.ficha?.direccion).toBeTruthy();
    expect(resultado.requiereAltaDireccion).toBeUndefined();
  });

  it('sin match por cédula devuelve SIN_MATCH', async () => {
    const resultado = await service.identificar({
      identificador: '99999999', tipo: 'CEDULA', rol: 'CALL_CENTER',
    });

    expect(resultado.resultado).toBe('SIN_MATCH');
    expect(resultado.ficha).toBeUndefined();
    expect(personas.find360).not.toHaveBeenCalled();
  });

  it('sin match por teléfono devuelve SIN_MATCH', async () => {
    const resultado = await service.identificar({
      identificador: '000000000', tipo: 'TELEFONO', rol: 'DISTRIBUIDOR', empresaFleteraId: 100,
    });

    expect(resultado.resultado).toBe('SIN_MATCH');
  });

  describe('teléfono compartido (I2)', () => {
    it('un número con 2 personas distintas detrás devuelve SIN_MATCH (ambiguo, no adivina)', async () => {
      fake.clienteUnis = [
        {
          id: 10,
          personaId: 1,
          nombre: 'Juan Pérez',
          telefonos: [{ id: 100, clienteId: 10, numero: '098765432', estado: 'A' }],
          direcciones: [],
        },
        {
          id: 11,
          personaId: 2,
          nombre: 'Otra Persona',
          telefonos: [{ id: 101, clienteId: 11, numero: '098765432', estado: 'A' }],
          direcciones: [],
        },
      ];

      const resultado = await service.identificar({
        identificador: '098765432', tipo: 'TELEFONO', rol: 'CALL_CENTER',
      });

      expect(resultado.resultado).toBe('SIN_MATCH');
      expect(personas.find360).not.toHaveBeenCalled();
    });

    it('un número activo único resuelve MATCH', async () => {
      personas.find360.mockResolvedValue(ficha360Base);
      fake.clienteUnis = [
        {
          id: 10,
          personaId: 1,
          nombre: 'Juan Pérez',
          telefonos: [{ id: 100, clienteId: 10, numero: '098765432', estado: 'A' }],
          direcciones: [],
        },
      ];

      const resultado = await service.identificar({
        identificador: '098765432', tipo: 'TELEFONO', rol: 'CALL_CENTER',
      });

      expect(resultado.resultado).toBe('MATCH');
    });
  });
});
