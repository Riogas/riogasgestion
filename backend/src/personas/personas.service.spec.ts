import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonasService } from './personas.service';
import { FakePrismaService } from './__tests__/prisma-fake';

describe('PersonasService', () => {
  let fake: FakePrismaService;
  let service: PersonasService;

  beforeEach(() => {
    fake = new FakePrismaService();
    fake.personas = [
      { id: 1, nombreOficial: 'Juan Pérez', cedula: null },
      { id: 2, nombreOficial: 'Juan P.', cedula: null },
    ];
    fake.clienteUnis = [
      {
        id: 10,
        personaId: 1,
        nombre: 'Juan Pérez',
        cedula: null,
        ruc: null,
        telefonos: [{ id: 100, clienteId: 10, numero: '091111111' }],
        direcciones: [{ id: 1000, clienteId: 10, direccionTextoNorm: 'MO|MVD|AV ITALIA 2020|' }],
      },
      {
        id: 20,
        personaId: 2,
        nombre: 'Juan P.',
        cedula: null,
        ruc: null,
        telefonos: [{ id: 200, clienteId: 20, numero: '092222222' }],
        direcciones: [{ id: 2000, clienteId: 20, direccionTextoNorm: 'MO|MVD|AV ITALIA 2020|' }],
      },
    ];

    service = new PersonasService(fake as unknown as PrismaService);
  });

  describe('find360', () => {
    it('agrega los teléfonos de todos los registros de la persona', async () => {
      // Primero unificamos para que ambos registros crudos cuelguen de la misma persona.
      await service.unify([10, 20]);

      const vista = await service.find360(1);

      expect(vista.registros).toHaveLength(2);
      expect(vista.telefonos.map((t) => t.numero).sort()).toEqual(['091111111', '092222222']);
      expect(vista.direcciones).toHaveLength(2);
    });

    it('lanza NotFoundException si la persona no existe', async () => {
      await expect(service.find360(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('unify', () => {
    it('repunta ambos registros a la persona del primer registro y borra la persona huérfana', async () => {
      const { personaId } = await service.unify([10, 20]);

      expect(personaId).toBe(1);

      const registroA = await fake.clienteUni.findUnique({ where: { id: 10 } });
      const registroB = await fake.clienteUni.findUnique({ where: { id: 20 } });
      expect(registroA?.personaId).toBe(1);
      expect(registroB?.personaId).toBe(1);

      const personaOrigen = await fake.persona.findUnique({ where: { id: 2 } });
      expect(personaOrigen).toBeNull();
    });

    it('I4: transfiere la cobertura de la persona absorbida al destino en vez de perderla', async () => {
      fake.coberturas = [
        {
          id: 1,
          personaId: 2,
          puestoId: 5,
          empresaFleteraId: 100,
          tipoInteraccion: 'LLAMADA_DIRECTA',
          primeraFecha: new Date('2026-01-01'),
          ultFecha: new Date('2026-01-15'),
          cantPedidos: 3,
        },
      ];

      await service.unify([10, 20]);

      expect(fake.coberturas).toHaveLength(1);
      const coberturaDestino = fake.coberturas[0];
      expect(coberturaDestino.personaId).toBe(1);
      expect(coberturaDestino.empresaFleteraId).toBe(100);
      expect(coberturaDestino.cantPedidos).toBe(3);
    });

    it('I4: si el destino ya tenía cobertura del mismo distribuidor, hace merge (ultFecha max + suma cantPedidos)', async () => {
      fake.coberturas = [
        {
          id: 1,
          personaId: 1,
          puestoId: 5,
          empresaFleteraId: 100,
          tipoInteraccion: 'LLAMADA_DIRECTA',
          primeraFecha: new Date('2026-01-01'),
          ultFecha: new Date('2026-01-10'),
          cantPedidos: 2,
        },
        {
          id: 2,
          personaId: 2,
          puestoId: 5,
          empresaFleteraId: 100,
          tipoInteraccion: 'LLAMADA_DIRECTA',
          primeraFecha: new Date('2026-01-05'),
          ultFecha: new Date('2026-01-20'),
          cantPedidos: 3,
        },
      ];

      await service.unify([10, 20]);

      expect(fake.coberturas).toHaveLength(1);
      const coberturaDestino = fake.coberturas[0];
      expect(coberturaDestino.personaId).toBe(1);
      expect(coberturaDestino.cantPedidos).toBe(5);
      expect(coberturaDestino.ultFecha).toEqual(new Date('2026-01-20'));
    });

    it('I4: transfiere la membresía de hogar de la persona absorbida al destino', async () => {
      fake.hogares = [{ id: 100, etiqueta: null, direccionTextoNorm: null }];
      fake.hogarMiembros = [{ id: 1, hogarId: 100, personaId: 2, rol: null }];

      await service.unify([10, 20]);

      expect(fake.hogarMiembros).toHaveLength(1);
      expect(fake.hogarMiembros[0].personaId).toBe(1);
      expect(fake.hogarMiembros[0].hogarId).toBe(100);
    });
  });

  describe('split', () => {
    it('después de unify, split del registro B le crea una persona propia nueva', async () => {
      await service.unify([10, 20]);

      const { nuevas } = await service.split([20]);

      expect(nuevas).toHaveLength(1);
      const nuevaPersonaId = nuevas[0];
      expect(nuevaPersonaId).not.toBe(1);

      const registroB = await fake.clienteUni.findUnique({ where: { id: 20 } });
      expect(registroB?.personaId).toBe(nuevaPersonaId);

      const registroA = await fake.clienteUni.findUnique({ where: { id: 10 } });
      expect(registroA?.personaId).toBe(1);
    });
  });

  describe('setCanonical', () => {
    it('actualiza los campos curados de la persona', async () => {
      const actualizada = await service.setCanonical(1, { nombreOficial: 'Juan Pérez García', cedula: '12345678' });

      expect(actualizada.nombreOficial).toBe('Juan Pérez García');
      expect(actualizada.cedula).toBe('12345678');
    });

    it('lanza NotFoundException si la persona no existe', async () => {
      await expect(service.setCanonical(999, { nombreOficial: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('M5: lanza ConflictException (no un error crudo de Prisma) si la cédula ya está asignada a otra persona', async () => {
      await service.setCanonical(1, { cedula: '11111111' });

      await expect(service.setCanonical(2, { cedula: '11111111' })).rejects.toThrow(ConflictException);
    });
  });
});
