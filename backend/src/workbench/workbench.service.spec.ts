import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonasService } from '../personas/personas.service';
import { HogarService } from '../personas/hogar.service';
import { FakePrismaService } from '../personas/__tests__/prisma-fake';
import { WorkbenchService } from './workbench.service';

describe('WorkbenchService', () => {
  let fake: FakePrismaService;
  let personas: jest.Mocked<PersonasService>;
  let hogar: jest.Mocked<HogarService>;
  let service: WorkbenchService;

  beforeEach(() => {
    fake = new FakePrismaService();
    fake.matchSugerencias = [
      {
        id: 1,
        tipo: 'DUPLICADO',
        registroA: 10,
        registroB: 20,
        personaA: null,
        personaB: null,
        senal: 'CEDULA',
        confianza: 0.99,
        estado: 'PENDIENTE',
        operador: null,
        resueltoAt: null,
      },
      {
        id: 2,
        tipo: 'HOGAR',
        registroA: null,
        registroB: null,
        personaA: 1,
        personaB: 2,
        senal: 'MISMA_DIRECCION',
        confianza: 0.9,
        estado: 'PENDIENTE',
        operador: null,
        resueltoAt: null,
        hogarIdResuelto: null,
      },
      {
        id: 3,
        tipo: 'DUPLICADO',
        registroA: 30,
        registroB: 40,
        personaA: null,
        personaB: null,
        senal: 'RUC',
        confianza: 0.7,
        estado: 'ACEPTADO',
        operador: 'ana',
        resueltoAt: new Date('2026-01-01'),
      },
    ];
    fake.hogarMiembros = [
      { id: 1, hogarId: 100, personaId: 1, rol: null },
      { id: 2, hogarId: 100, personaId: 2, rol: null },
    ];

    personas = { unify: jest.fn() } as unknown as jest.Mocked<PersonasService>;
    hogar = {
      crearConMiembros: jest.fn().mockResolvedValue({ id: 100 }),
      quitarMiembro: jest.fn(),
    } as unknown as jest.Mocked<HogarService>;

    service = new WorkbenchService(
      fake as unknown as PrismaService,
      personas,
      hogar,
    );
  });

  describe('listar', () => {
    it('filtra por tipo/estado y ordena por confianza desc', async () => {
      const resultado = await service.listar({ tipo: 'DUPLICADO' });

      expect(resultado.data.map((s) => s.id)).toEqual([1, 3]);
      expect(resultado.total).toBe(2);
      expect(resultado.page).toBe(1);
      expect(resultado.pageSize).toBe(20);
    });

    it('filtra por estado y minConfianza', async () => {
      const resultado = await service.listar({ estado: 'PENDIENTE', minConfianza: 0.95 });

      expect(resultado.data.map((s) => s.id)).toEqual([1]);
      expect(resultado.total).toBe(1);
    });

    it('ordena todas las sugerencias por confianza desc', async () => {
      const resultado = await service.listar({});

      expect(resultado.data.map((s) => s.confianza)).toEqual([0.99, 0.9, 0.7]);
    });
  });

  describe('aceptar', () => {
    it('en DUPLICADO llama a unify con los registros (dentro de la transacción) y marca ACEPTADO', async () => {
      await service.aceptar(1, 'operador1');

      expect(personas.unify).toHaveBeenCalledWith([10, 20], 'operador1', expect.anything());
      const actualizada = await fake.matchSugerencia.findUnique({ where: { id: 1 } });
      expect(actualizada?.estado).toBe('ACEPTADO');
      expect(actualizada?.operador).toBe('operador1');
      expect(actualizada?.resueltoAt).toBeInstanceOf(Date);
    });

    it('en HOGAR llama a crearConMiembros con las personas, marca ACEPTADO y persiste hogarIdResuelto (I3)', async () => {
      await service.aceptar(2, 'operador1');

      expect(hogar.crearConMiembros).toHaveBeenCalledWith([1, 2], undefined, expect.anything());
      const actualizada = await fake.matchSugerencia.findUnique({ where: { id: 2 } });
      expect(actualizada?.estado).toBe('ACEPTADO');
      expect(actualizada?.hogarIdResuelto).toBe(100);
    });

    it('lanza NotFoundException si la sugerencia no existe', async () => {
      await expect(service.aceptar(999, 'op')).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si la sugerencia no está PENDIENTE', async () => {
      await expect(service.aceptar(3, 'op')).rejects.toThrow(BadRequestException);
      expect(personas.unify).not.toHaveBeenCalled();
    });
  });

  describe('rechazar', () => {
    it('marca la sugerencia como RECHAZADO con operador y fecha', async () => {
      await service.rechazar(1, 'operador2');

      const actualizada = await fake.matchSugerencia.findUnique({ where: { id: 1 } });
      expect(actualizada?.estado).toBe('RECHAZADO');
      expect(actualizada?.operador).toBe('operador2');
      expect(actualizada?.resueltoAt).toBeInstanceOf(Date);
    });

    it('lanza NotFoundException si la sugerencia no existe', async () => {
      await expect(service.rechazar(999, 'op')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deshacer', () => {
    it('en HOGAR usa el hogarIdResuelto guardado al aceptar para quitar los miembros y vuelve a PENDIENTE (I3)', async () => {
      await service.aceptar(2, 'operador1');

      await service.deshacer(2);

      expect(hogar.quitarMiembro).toHaveBeenCalledWith(100, 1);
      expect(hogar.quitarMiembro).toHaveBeenCalledWith(100, 2);
      const actualizada = await fake.matchSugerencia.findUnique({ where: { id: 2 } });
      expect(actualizada?.estado).toBe('PENDIENTE');
      expect(actualizada?.resueltoAt).toBeNull();
    });

    it('en HOGAR sin hogarIdResuelto (sugerencia vieja) no llama a quitarMiembro pero igual vuelve a PENDIENTE', async () => {
      // No pasa por aceptar(): simula una sugerencia HOGAR ya aceptada antes
      // de que existiera la columna hogarIdResuelto.
      const vieja = fake.matchSugerencias.find((s) => s.id === 2);
      vieja!.estado = 'ACEPTADO';
      vieja!.hogarIdResuelto = null;

      await service.deshacer(2);

      expect(hogar.quitarMiembro).not.toHaveBeenCalled();
      const actualizada = await fake.matchSugerencia.findUnique({ where: { id: 2 } });
      expect(actualizada?.estado).toBe('PENDIENTE');
    });

    it('en DUPLICADO no llama a ningún split y vuelve a PENDIENTE', async () => {
      await service.aceptar(1, 'operador1');

      await service.deshacer(1);

      const actualizada = await fake.matchSugerencia.findUnique({ where: { id: 1 } });
      expect(actualizada?.estado).toBe('PENDIENTE');
      expect(actualizada?.resueltoAt).toBeNull();
    });

    it('lanza NotFoundException si la sugerencia no existe', async () => {
      await expect(service.deshacer(999)).rejects.toThrow(NotFoundException);
    });
  });
});
