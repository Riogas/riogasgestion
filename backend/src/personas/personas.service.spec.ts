import { NotFoundException } from '@nestjs/common';
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
  });
});
