import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SorteosService, ParticiparInput } from './sorteos.service';

const CODIGO = 'ABCD2345EFGH';
const CANJE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
const NOW = new Date('2026-08-15T12:00:00Z');

function crearPrismaMock() {
  const mock: any = {
    sorteo: { findUnique: jest.fn(), update: jest.fn() },
    sorteoCodigo: { findUnique: jest.fn(), updateMany: jest.fn() },
    sorteoParticipacion: { count: jest.fn(), create: jest.fn(), update: jest.fn() },
    sorteoMomentoGanador: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };
  mock.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(mock));
  return mock;
}

function sorteoBase(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    nombre: 'Sorteo Supergas',
    premioDescripcion: 'Una garrafa de 13 kg',
    fechaDesde: new Date('2026-08-01T03:00:00Z'),
    fechaHasta: new Date('2026-09-01T03:00:00Z'),
    cantidadPremios: 10,
    maxRegistrosDispositivoDia: 1,
    edadMinima: 18,
    estado: 'activo',
    ...over,
  };
}

function inputBase(over: Partial<ParticiparInput> = {}): ParticiparInput {
  return {
    codigo: CODIGO,
    nombre: 'Juan Pérez',
    telefono: '+598 99 123 456',
    edad: 30,
    deviceId: 'dev-1',
    ...over,
  };
}

describe('SorteosService', () => {
  let prisma: any;
  let service: SorteosService;

  /** El count de participaciones se usa para dos cosas: límite por dispositivo y "ya ganó". */
  function mockCounts({ dispositivo = 0, ganadoresTelefono = 0 } = {}) {
    prisma.sorteoParticipacion.count.mockImplementation(async (args: any) =>
      args?.where?.ganador === true ? ganadoresTelefono : dispositivo,
    );
  }

  function mockCodigo(over: Record<string, unknown> = {}, sorteoOver: Record<string, unknown> = {}) {
    prisma.sorteoCodigo.findUnique.mockResolvedValue({
      id: 55,
      sorteoId: 7,
      loteId: 3,
      codigo: CODIGO,
      estado: 'disponible',
      usadoAt: null,
      sorteo: sorteoBase(sorteoOver),
      ...over,
    });
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    prisma = crearPrismaMock();
    service = new SorteosService(prisma as unknown as PrismaService);

    mockCodigo();
    mockCounts();
    prisma.sorteoCodigo.updateMany.mockResolvedValue({ count: 1 });
    prisma.sorteoParticipacion.create.mockResolvedValue({ id: 900 });
    prisma.sorteoParticipacion.update.mockResolvedValue({ id: 900 });
    prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(null);
    prisma.sorteoMomentoGanador.updateMany.mockResolvedValue({ count: 1 });
    prisma.sorteoMomentoGanador.createMany.mockResolvedValue({ count: 0 });
    prisma.sorteoMomentoGanador.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sorteoMomentoGanador.count.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── participar: validaciones ─────────────────────────────────────────────

  describe('participar — validaciones', () => {
    it('código inexistente → invalido', async () => {
      prisma.sorteoCodigo.findUnique.mockResolvedValue(null);

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'invalido' });
      expect(prisma.sorteoParticipacion.create).not.toHaveBeenCalled();
    });

    it('código con formato inválido → invalido sin tocar la base', async () => {
      await expect(service.participar(inputBase({ codigo: 'no-es-un-codigo' }))).resolves.toEqual({
        resultado: 'invalido',
      });
      expect(prisma.sorteoCodigo.findUnique).not.toHaveBeenCalled();
    });

    it('código ya usado → usado', async () => {
      mockCodigo({ estado: 'usado', usadoAt: new Date('2026-08-10T10:00:00Z') });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'usado' });
      expect(prisma.sorteoCodigo.updateMany).not.toHaveBeenCalled();
      expect(prisma.sorteoParticipacion.create).not.toHaveBeenCalled();
    });

    it('sorteo en borrador → no_iniciado', async () => {
      mockCodigo({}, { estado: 'borrador' });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'no_iniciado' });
    });

    it('sorteo cancelado → no_iniciado', async () => {
      mockCodigo({}, { estado: 'cancelado' });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'no_iniciado' });
    });

    it('sorteo que todavía no arrancó (now < fechaDesde) → no_iniciado', async () => {
      mockCodigo({}, { fechaDesde: new Date('2026-08-20T03:00:00Z') });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'no_iniciado' });
    });

    it('sorteo finalizado por estado → finalizado', async () => {
      mockCodigo({}, { estado: 'finalizado' });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'finalizado' });
    });

    it('sorteo vencido (now > fechaHasta) → finalizado', async () => {
      mockCodigo({}, { fechaHasta: new Date('2026-08-10T03:00:00Z') });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'finalizado' });
    });

    it('edad menor a la mínima → edad_invalida', async () => {
      await expect(service.participar(inputBase({ edad: 17 }))).resolves.toEqual({
        resultado: 'edad_invalida',
      });
      expect(prisma.sorteoCodigo.updateMany).not.toHaveBeenCalled();
    });

    it('límite de registros por dispositivo alcanzado → limite_dispositivo', async () => {
      mockCounts({ dispositivo: 1 });

      await expect(service.participar(inputBase())).resolves.toEqual({
        resultado: 'limite_dispositivo',
      });
      expect(prisma.sorteoParticipacion.create).not.toHaveBeenCalled();
    });

    it('el límite por dispositivo cuenta desde el inicio del día de Montevideo', async () => {
      await service.participar(inputBase());

      const where = prisma.sorteoParticipacion.count.mock.calls[0][0].where;
      expect(where.sorteoId).toBe(7);
      expect(where.deviceId).toBe('dev-1');
      expect(where.createdAt.gte.toISOString()).toBe('2026-08-15T03:00:00.000Z');
    });

    it('carrera del código: el consumo atómico devuelve count 0 → usado', async () => {
      prisma.sorteoCodigo.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'usado' });
      expect(prisma.sorteoParticipacion.create).not.toHaveBeenCalled();
    });

    it('corre todo dentro de una transacción', async () => {
      await service.participar(inputBase());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── participar: consumo y persistencia ───────────────────────────────────

  describe('participar — consumo del código y participación', () => {
    it('consume el código con updateMany condicionado a estado disponible', async () => {
      await service.participar(inputBase());

      expect(prisma.sorteoCodigo.updateMany).toHaveBeenCalledWith({
        where: { id: 55, estado: 'disponible' },
        data: { estado: 'usado', usadoAt: NOW },
      });
    });

    it('guarda el teléfono normalizado a formato local', async () => {
      await service.participar(inputBase({ telefono: '+598 99 123 456' }));

      expect(prisma.sorteoParticipacion.create.mock.calls[0][0].data.telefono).toBe('099123456');
    });

    it('normaliza un teléfono ya local dejándolo igual', async () => {
      await service.participar(inputBase({ telefono: '099 123 456' }));

      expect(prisma.sorteoParticipacion.create.mock.calls[0][0].data.telefono).toBe('099123456');
    });

    it('normaliza un fijo con prefijo país sin anteponer 0', async () => {
      await service.participar(inputBase({ telefono: '+598 2 400 1234' }));

      expect(prisma.sorteoParticipacion.create.mock.calls[0][0].data.telefono).toBe('24001234');
    });

    it('guarda los datos invisibles del dispositivo', async () => {
      await service.participar(
        inputBase({
          fingerprint: 'fp-abc',
          userAgent: 'Mozilla/5.0',
          ip: '190.64.1.2',
          idioma: 'es-UY',
          plataforma: 'Android',
          resolucion: '412x915',
        }),
      );

      const data = prisma.sorteoParticipacion.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        sorteoId: 7,
        codigoId: 55,
        nombre: 'Juan Pérez',
        edad: 30,
        deviceId: 'dev-1',
        fingerprint: 'fp-abc',
        userAgent: 'Mozilla/5.0',
        ip: '190.64.1.2',
        idioma: 'es-UY',
        plataforma: 'Android',
        resolucion: '412x915',
      });
    });

    it('con GPS guarda las coordenadas crudas y geoFuente gps', async () => {
      await service.participar(inputBase({ gpsLat: -34.9011, gpsLng: -56.1645 }));

      const data = prisma.sorteoParticipacion.create.mock.calls[0][0].data;
      expect(data.gpsLat).toBe(-34.9011);
      expect(data.gpsLng).toBe(-56.1645);
      expect(data.geoFuente).toBe('gps');
    });

    it('sin GPS deja las coordenadas y geoFuente en null', async () => {
      await service.participar(inputBase());

      const data = prisma.sorteoParticipacion.create.mock.calls[0][0].data;
      expect(data.gpsLat).toBeNull();
      expect(data.gpsLng).toBeNull();
      expect(data.geoFuente).toBeNull();
    });
  });

  // ─── participar: premio ───────────────────────────────────────────────────

  describe('participar — momentos ganadores', () => {
    const momento = { id: 33, sorteoId: 7, fechaMomento: new Date('2026-08-15T09:00:00Z'), participacionId: null };

    it('momento vencido disponible + teléfono nuevo → ganador con código de canje', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(momento);

      const r = await service.participar(inputBase());

      expect(r.resultado).toBe('ganador');
      expect(r.codigoCanje).toMatch(CANJE_REGEX);
      expect(prisma.sorteoMomentoGanador.updateMany).toHaveBeenCalledWith({
        where: { id: 33, participacionId: null },
        data: { participacionId: 900 },
      });
      expect(prisma.sorteoParticipacion.update).toHaveBeenCalledWith({
        where: { id: 900 },
        data: { ganador: true, codigoCanje: r.codigoCanje },
      });
    });

    it('busca el momento vencido más viejo todavía sin dueño', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(momento);

      await service.participar(inputBase());

      expect(prisma.sorteoMomentoGanador.findFirst).toHaveBeenCalledWith({
        where: { sorteoId: 7, participacionId: null, fechaMomento: { lte: NOW } },
        orderBy: { fechaMomento: 'asc' },
      });
    });

    it('teléfono que ya ganó en el sorteo → sigue, sin reclamar el momento', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(momento);
      mockCounts({ ganadoresTelefono: 1 });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'sigue' });
      expect(prisma.sorteoMomentoGanador.updateMany).not.toHaveBeenCalled();
      expect(prisma.sorteoParticipacion.update).not.toHaveBeenCalled();
    });

    it('el chequeo de "ya ganó" usa el teléfono normalizado', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(momento);

      await service.participar(inputBase({ telefono: '+598 99 123 456' }));

      const llamada = prisma.sorteoParticipacion.count.mock.calls.find(
        (c: any[]) => c[0]?.where?.ganador === true,
      );
      expect(llamada[0].where).toMatchObject({ sorteoId: 7, telefono: '099123456', ganador: true });
    });

    it('carrera del momento: el claim devuelve count 0 → sigue', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(momento);
      prisma.sorteoMomentoGanador.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'sigue' });
      expect(prisma.sorteoParticipacion.update).not.toHaveBeenCalled();
    });

    it('sin momento vencido pendiente → sigue', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(null);

      await expect(service.participar(inputBase())).resolves.toEqual({ resultado: 'sigue' });
      expect(prisma.sorteoMomentoGanador.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── estadoPublico ────────────────────────────────────────────────────────

  describe('estadoPublico', () => {
    it('código disponible en sorteo vigente → ok con los datos públicos del sorteo', async () => {
      await expect(service.estadoPublico(CODIGO)).resolves.toEqual({
        estado: 'ok',
        sorteo: {
          nombre: 'Sorteo Supergas',
          premioDescripcion: 'Una garrafa de 13 kg',
          edadMinima: 18,
        },
      });
    });

    it('código inexistente → invalido', async () => {
      prisma.sorteoCodigo.findUnique.mockResolvedValue(null);

      await expect(service.estadoPublico(CODIGO)).resolves.toEqual({ estado: 'invalido' });
    });

    it('código con formato inválido → invalido sin tocar la base', async () => {
      await expect(service.estadoPublico('123')).resolves.toEqual({ estado: 'invalido' });
      expect(prisma.sorteoCodigo.findUnique).not.toHaveBeenCalled();
    });

    it('código usado → usado', async () => {
      mockCodigo({ estado: 'usado' });

      await expect(service.estadoPublico(CODIGO)).resolves.toEqual({ estado: 'usado' });
    });

    it('sorteo que no arrancó → no_iniciado', async () => {
      mockCodigo({}, { fechaDesde: new Date('2026-08-20T03:00:00Z') });

      await expect(service.estadoPublico(CODIGO)).resolves.toEqual({ estado: 'no_iniciado' });
    });

    it('sorteo vencido → finalizado', async () => {
      mockCodigo({}, { fechaHasta: new Date('2026-08-10T03:00:00Z') });

      await expect(service.estadoPublico(CODIGO)).resolves.toEqual({ estado: 'finalizado' });
    });
  });

  // ─── activar ──────────────────────────────────────────────────────────────

  describe('activar', () => {
    it('genera un momento por premio dentro del rango vigente y pasa a activo', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ estado: 'borrador', cantidadPremios: 5 }));
      prisma.sorteo.update.mockResolvedValue(sorteoBase({ estado: 'activo', cantidadPremios: 5 }));

      const r = await service.activar(7);

      const filas = prisma.sorteoMomentoGanador.createMany.mock.calls[0][0].data;
      expect(filas).toHaveLength(5);
      for (const f of filas) {
        expect(f.sorteoId).toBe(7);
        expect(f.fechaMomento.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
        expect(f.fechaMomento.getTime()).toBeLessThanOrEqual(new Date('2026-09-01T03:00:00Z').getTime());
      }
      expect(prisma.sorteo.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { estado: 'activo' } });
      expect(r.estado).toBe('activo');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('respeta fechaDesde si todavía es futura', async () => {
      const fechaDesde = new Date('2026-08-20T03:00:00Z');
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ estado: 'borrador', cantidadPremios: 3, fechaDesde }));
      prisma.sorteo.update.mockResolvedValue(sorteoBase({ estado: 'activo' }));

      await service.activar(7);

      const filas = prisma.sorteoMomentoGanador.createMany.mock.calls[0][0].data;
      for (const f of filas) {
        expect(f.fechaMomento.getTime()).toBeGreaterThanOrEqual(fechaDesde.getTime());
      }
    });

    it('sorteo inexistente → NotFoundException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.activar(7)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sorteo que no está en borrador → BadRequestException y no genera momentos', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ estado: 'activo' }));

      await expect(service.activar(7)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sorteoMomentoGanador.createMany).not.toHaveBeenCalled();
    });
  });

  // ─── regenerarMomentosPendientes ──────────────────────────────────────────

  describe('regenerarMomentosPendientes', () => {
    it('borra los momentos sin ganador y regenera solo los premios restantes', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ cantidadPremios: 10 }));
      prisma.sorteoMomentoGanador.count.mockResolvedValue(4);

      const r = await service.regenerarMomentosPendientes(7);

      expect(prisma.sorteoMomentoGanador.deleteMany).toHaveBeenCalledWith({
        where: { sorteoId: 7, participacionId: null },
      });
      const filas = prisma.sorteoMomentoGanador.createMany.mock.calls[0][0].data;
      expect(filas).toHaveLength(6);
      for (const f of filas) {
        expect(f.fechaMomento.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
        expect(f.fechaMomento.getTime()).toBeLessThanOrEqual(new Date('2026-09-01T03:00:00Z').getTime());
      }
      expect(r).toEqual({ generados: 6, ganadores: 4 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('si ya se entregaron todos los premios no genera momentos nuevos', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ cantidadPremios: 10 }));
      prisma.sorteoMomentoGanador.count.mockResolvedValue(10);

      const r = await service.regenerarMomentosPendientes(7);

      expect(prisma.sorteoMomentoGanador.deleteMany).toHaveBeenCalled();
      expect(prisma.sorteoMomentoGanador.createMany).not.toHaveBeenCalled();
      expect(r).toEqual({ generados: 0, ganadores: 10 });
    });

    it('sorteo inexistente → NotFoundException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.regenerarMomentosPendientes(7)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
