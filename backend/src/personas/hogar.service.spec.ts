import { PrismaService } from '../prisma/prisma.service';
import { HogarService } from './hogar.service';
import { FakePrismaService } from './__tests__/prisma-fake';

const DIR_NORM = 'MO|MVD|AV ITALIA 2020|';

describe('HogarService', () => {
  let fake: FakePrismaService;
  let service: HogarService;

  beforeEach(() => {
    fake = new FakePrismaService();
    fake.personas = [
      { id: 1, nombreOficial: 'Juan Pérez', direccionPrincipalId: 1000 },
      { id: 2, nombreOficial: 'María Pérez', direccionPrincipalId: 2000 },
      { id: 3, nombreOficial: 'Pedro Pérez', direccionPrincipalId: 3000 },
    ];
    fake.clienteUnis = [
      {
        id: 10,
        personaId: 1,
        telefonos: [],
        direcciones: [{
          id: 1000, clienteId: 10, direccionTextoNorm: DIR_NORM, lat: -34.9, lng: -56.15,
        }],
      },
      {
        id: 20,
        personaId: 2,
        telefonos: [],
        direcciones: [{
          id: 2000, clienteId: 20, direccionTextoNorm: DIR_NORM, lat: -34.9, lng: -56.15,
        }],
      },
      {
        id: 30,
        personaId: 3,
        telefonos: [],
        direcciones: [{
          id: 3000, clienteId: 30, direccionTextoNorm: DIR_NORM, lat: -34.9, lng: -56.15,
        }],
      },
    ];

    service = new HogarService(fake as unknown as PrismaService);
  });

  describe('crearConMiembros', () => {
    it('crea 1 hogar con 2 miembros', async () => {
      const hogar = await service.crearConMiembros([1, 2], 'Familia Pérez');

      expect(fake.hogares).toHaveLength(1);
      expect(hogar.direccionTextoNorm).toBe(DIR_NORM);
      expect(fake.hogarMiembros).toHaveLength(2);
      expect(fake.hogarMiembros.map((m) => m.personaId).sort()).toEqual([1, 2]);
    });

    it('no duplica miembros si se vuelve a llamar con las mismas personas', async () => {
      await service.crearConMiembros([1, 2]);
      await service.crearConMiembros([1, 2]);

      expect(fake.hogares).toHaveLength(1);
      expect(fake.hogarMiembros).toHaveLength(2);
    });

    it('una segunda persona con la misma direccionTextoNorm se une al mismo hogar', async () => {
      await service.crearConMiembros([1, 2]);
      const hogar2 = await service.crearConMiembros([3]);

      expect(fake.hogares).toHaveLength(1);
      expect(hogar2.id).toBe(fake.hogares[0].id);
      expect(fake.hogarMiembros).toHaveLength(3);
      expect(fake.hogarMiembros.map((m) => m.personaId).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('agregarMiembro / quitarMiembro', () => {
    it('agrega un miembro a un hogar existente', async () => {
      const hogar = await service.crearConMiembros([1]);

      await service.agregarMiembro(hogar.id, 2, 'FAMILIAR');

      expect(fake.hogarMiembros).toHaveLength(2);
      const miembro = fake.hogarMiembros.find((m) => m.personaId === 2);
      expect(miembro?.rol).toBe('FAMILIAR');
    });

    it('quita un miembro de un hogar', async () => {
      const hogar = await service.crearConMiembros([1, 2]);

      await service.quitarMiembro(hogar.id, 2);

      expect(fake.hogarMiembros).toHaveLength(1);
      expect(fake.hogarMiembros[0].personaId).toBe(1);
    });
  });
});
