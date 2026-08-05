import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GeoService } from './geo.service';
import { PrismaService } from '../prisma/prisma.service';
import { SorteosService, ParticiparInput } from './sorteos.service';

const CODIGO = 'ABCD2345EFGH';
const CANJE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
const NOW = new Date('2026-08-15T12:00:00Z');

function crearPrismaMock() {
  const mock: any = {
    sorteo: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sorteoLote: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    sorteoCodigo: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    sorteoParticipacion: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    sorteoMomentoGanador: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };
  mock.$executeRaw = jest.fn();
  mock.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(mock));
  return mock;
}

function crearGeoMock() {
  return {
    porIp: jest.fn().mockReturnValue({}),
    reverse: jest.fn().mockResolvedValue({}),
  };
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
  let geo: any;
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
    geo = crearGeoMock();
    service = new SorteosService(prisma as unknown as PrismaService, geo as unknown as GeoService);

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
    prisma.$executeRaw.mockResolvedValue(1);
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

    it('con coordenadas y reverse con datos, geoFuente queda en gps y guarda los campos del reverse', async () => {
      geo.reverse.mockResolvedValue({
        gpsPais: 'Uruguay',
        gpsDepartamento: 'Montevideo',
        gpsLocalidad: 'Pocitos',
      });

      await service.participar(inputBase({ gpsLat: -34.9011, gpsLng: -56.1645 }));

      expect(geo.reverse).toHaveBeenCalledWith(-34.9011, -56.1645);
      const data = prisma.sorteoParticipacion.create.mock.calls[0][0].data;
      expect(data.geoFuente).toBe('gps');
      expect(data.gpsPais).toBe('Uruguay');
      expect(data.gpsDepartamento).toBe('Montevideo');
      expect(data.gpsLocalidad).toBe('Pocitos');
    });

    it('sin GPS pero con país por IP, geoFuente queda en ip', async () => {
      geo.porIp.mockReturnValue({ ipPais: 'Uruguay', ipRegion: 'MO', ipCiudad: 'Montevideo' });

      await service.participar(inputBase({ ip: '190.64.1.2' }));

      expect(geo.reverse).not.toHaveBeenCalled();
      const data = prisma.sorteoParticipacion.create.mock.calls[0][0].data;
      expect(data.geoFuente).toBe('ip');
      expect(data.ipPais).toBe('Uruguay');
      expect(data.ipRegion).toBe('MO');
      expect(data.ipCiudad).toBe('Montevideo');
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

    it('toma un advisory lock por sorteo+teléfono normalizado antes de evaluar el premio', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(momento);

      await service.participar(inputBase({ telefono: '+598 99 123 456' }));

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const [sql, valor] = prisma.$executeRaw.mock.calls[0];
      expect(sql.join('?')).toContain('pg_advisory_xact_lock(hashtext(');
      expect(valor).toBe('sorteo:7:tel:099123456');
    });

    it('el advisory lock se toma antes del count de "ya ganó"', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(momento);

      await service.participar(inputBase());

      const ordenLock = prisma.$executeRaw.mock.invocationCallOrder[0];
      const indiceCount = prisma.sorteoParticipacion.count.mock.calls.findIndex(
        (c: any[]) => c[0]?.where?.ganador === true,
      );
      const ordenCount = prisma.sorteoParticipacion.count.mock.invocationCallOrder[indiceCount];
      expect(ordenLock).toBeLessThan(ordenCount);
    });

    it('el lock también se toma cuando no hay momento pendiente (no depende del resultado)', async () => {
      prisma.sorteoMomentoGanador.findFirst.mockResolvedValue(null);

      await service.participar(inputBase());

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
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

    it.each(['borrador', 'finalizado', 'cancelado'])(
      'sorteo en %s → no toca los momentos',
      async (estado) => {
        prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ estado }));

        const r = await service.regenerarMomentosPendientes(7);

        expect(r).toEqual({ generados: 0, ganadores: 0, omitido: true });
        expect(prisma.sorteoMomentoGanador.deleteMany).not.toHaveBeenCalled();
        expect(prisma.sorteoMomentoGanador.createMany).not.toHaveBeenCalled();
      },
    );

    it('sorteo activo con la ventana ya vencida → no toca los momentos', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(
        sorteoBase({ fechaHasta: new Date('2026-08-15T11:59:59Z') }),
      );

      const r = await service.regenerarMomentosPendientes(7);

      expect(r).toEqual({ generados: 0, ganadores: 0, omitido: true });
      expect(prisma.sorteoMomentoGanador.deleteMany).not.toHaveBeenCalled();
      expect(prisma.sorteoMomentoGanador.createMany).not.toHaveBeenCalled();
    });
  });

  // ─── Admin: listado y alta ────────────────────────────────────────────────

  describe('listar', () => {
    beforeEach(() => {
      prisma.sorteo.findMany.mockResolvedValue([
        { ...sorteoBase(), _count: { participaciones: 12, codigos: 500 } },
      ]);
      prisma.sorteo.count.mockResolvedValue(1);
      prisma.sorteoParticipacion.groupBy.mockImplementation(async (args: any) =>
        args.where.ganador ? [{ sorteoId: 7, _count: { _all: 3 } }] : [{ sorteoId: 7, _count: { _all: 2 } }],
      );
    });

    it('devuelve items con los contadores y el total', async () => {
      const r = await service.listar({});

      expect(r.total).toBe(1);
      expect(r.items).toHaveLength(1);
      expect(r.items[0]._count).toEqual({ participaciones: 12, codigos: 500, ganadores: 3 });
      expect(r.items[0].premiosEntregados).toBe(2);
      expect(r.items[0].nombre).toBe('Sorteo Supergas');
    });

    it('pagina con page/pageSize y ordena por id descendente', async () => {
      await service.listar({ page: 3, pageSize: 5 });

      expect(prisma.sorteo.findMany.mock.calls[0][0]).toMatchObject({
        skip: 10,
        take: 5,
        orderBy: { id: 'desc' },
      });
    });

    it('sin paginación explícita usa la primera página de 20', async () => {
      await service.listar({});

      expect(prisma.sorteo.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 20 });
    });

    it('filtra por estado y busca por nombre', async () => {
      await service.listar({ estado: 'activo', search: '  super  ' });

      expect(prisma.sorteo.findMany.mock.calls[0][0].where).toEqual({
        estado: 'activo',
        nombre: { contains: 'super', mode: 'insensitive' },
      });
    });

    it('sorteo sin ganadores ni entregas → contadores en 0', async () => {
      prisma.sorteoParticipacion.groupBy.mockResolvedValue([]);

      const r = await service.listar({});

      expect(r.items[0]._count.ganadores).toBe(0);
      expect(r.items[0].premiosEntregados).toBe(0);
    });
  });

  describe('crear', () => {
    it('crea el sorteo en borrador', async () => {
      prisma.sorteo.create.mockResolvedValue(sorteoBase({ estado: 'borrador' }));

      await service.crear({
        nombre: '  Sorteo Supergas  ',
        premioDescripcion: 'Una garrafa',
        fechaDesde: new Date('2026-09-01T03:00:00Z'),
        fechaHasta: new Date('2026-10-01T03:00:00Z'),
        cantidadPremios: 10,
      });

      const data = prisma.sorteo.create.mock.calls[0][0].data;
      expect(data.estado).toBe('borrador');
      expect(data.nombre).toBe('Sorteo Supergas');
      expect(data.descripcion).toBeNull();
    });

    it('fechaHasta anterior o igual a fechaDesde → BadRequestException', async () => {
      await expect(
        service.crear({
          nombre: 'Sorteo',
          premioDescripcion: 'Una garrafa',
          fechaDesde: new Date('2026-10-01T03:00:00Z'),
          fechaHasta: new Date('2026-10-01T03:00:00Z'),
          cantidadPremios: 10,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sorteo.create).not.toHaveBeenCalled();
    });
  });

  // ─── Admin: detalle con stats ─────────────────────────────────────────────

  describe('detalle', () => {
    beforeEach(() => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase());
      prisma.sorteoParticipacion.count.mockImplementation(async (args: any) => {
        if (args.where.ganador) return 2;
        if (args.where.premioEntregado) return 1;
        return 4;
      });
      prisma.sorteoCodigo.count.mockImplementation(async (args: any) =>
        args.where.estado === 'usado' ? 4 : 500,
      );
      prisma.sorteoParticipacion.findMany.mockResolvedValue([
        // 02:00 UTC cae el día anterior en Montevideo (UTC-3)
        { createdAt: new Date('2026-08-15T02:00:00Z'), ganador: false, gpsDepartamento: 'Montevideo', ipRegion: 'MO' },
        { createdAt: new Date('2026-08-15T12:00:00Z'), ganador: true, gpsDepartamento: null, ipRegion: 'Canelones' },
        { createdAt: new Date('2026-08-15T18:00:00Z'), ganador: true, gpsDepartamento: 'Montevideo', ipRegion: null },
        { createdAt: new Date('2026-08-15T20:00:00Z'), ganador: false, gpsDepartamento: null, ipRegion: null },
      ]);
    });

    it('sorteo inexistente → NotFoundException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.detalle(7)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devuelve el sorteo con los contadores', async () => {
      const r = await service.detalle(7);

      expect(r.nombre).toBe('Sorteo Supergas');
      expect(r.stats).toMatchObject({
        participaciones: 4,
        ganadores: 2,
        premiosEntregados: 1,
        codigosTotal: 500,
        codigosUsados: 4,
      });
    });

    it('agrupa por día calendario de Montevideo', async () => {
      const r = await service.detalle(7);

      expect(r.stats.porDia).toEqual([
        { fecha: '2026-08-14', cantidad: 1, ganadores: 0 },
        { fecha: '2026-08-15', cantidad: 3, ganadores: 2 },
      ]);
    });

    it('agrupa por departamento con gpsDepartamento ?? ipRegion y descarta los sin dato', async () => {
      const r = await service.detalle(7);

      expect(r.stats.porDepartamento).toEqual([
        { departamento: 'Montevideo', cantidad: 2 },
        { departamento: 'Canelones', cantidad: 1 },
      ]);
    });
  });

  // ─── Admin: edición y transiciones ────────────────────────────────────────

  describe('actualizar', () => {
    beforeEach(() => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase());
      prisma.sorteo.update.mockResolvedValue(sorteoBase());
    });

    it('sorteo inexistente → NotFoundException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.actualizar(7, { nombre: 'Otro' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('valida el rango contra los valores ya guardados', async () => {
      await expect(
        service.actualizar(7, { fechaHasta: new Date('2026-07-01T03:00:00Z') }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sorteo.update).not.toHaveBeenCalled();
    });

    it('sorteo activo + cambio de cantidadPremios → regenera los momentos pendientes', async () => {
      await service.actualizar(7, { cantidadPremios: 20 });

      expect(prisma.sorteoMomentoGanador.deleteMany).toHaveBeenCalled();
    });

    it('sorteo activo + cambio de fechas → regenera los momentos pendientes', async () => {
      await service.actualizar(7, { fechaHasta: new Date('2026-10-01T03:00:00Z') });

      expect(prisma.sorteoMomentoGanador.deleteMany).toHaveBeenCalled();
    });

    it('cambio que no toca fechas ni premios → no regenera', async () => {
      await service.actualizar(7, { nombre: 'Nuevo nombre' });

      expect(prisma.sorteoMomentoGanador.deleteMany).not.toHaveBeenCalled();
    });

    it('mismos valores de fecha y premios → no regenera', async () => {
      await service.actualizar(7, {
        fechaDesde: new Date('2026-08-01T03:00:00Z'),
        cantidadPremios: 10,
      });

      expect(prisma.sorteoMomentoGanador.deleteMany).not.toHaveBeenCalled();
    });

    it('sorteo en borrador → no regenera aunque cambien los premios', async () => {
      prisma.sorteo.update.mockResolvedValue(sorteoBase({ estado: 'borrador' }));

      await service.actualizar(7, { cantidadPremios: 20 });

      expect(prisma.sorteoMomentoGanador.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('finalizar / cancelar', () => {
    it('finalizar un sorteo activo lo pasa a finalizado', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase());
      prisma.sorteo.update.mockResolvedValue(sorteoBase({ estado: 'finalizado' }));

      await service.finalizar(7);

      expect(prisma.sorteo.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { estado: 'finalizado' },
      });
    });

    it('finalizar un sorteo en borrador → BadRequestException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ estado: 'borrador' }));

      await expect(service.finalizar(7)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sorteo.update).not.toHaveBeenCalled();
    });

    it.each(['borrador', 'activo'])('cancelar un sorteo en %s lo pasa a cancelado', async (estado) => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ estado }));
      prisma.sorteo.update.mockResolvedValue(sorteoBase({ estado: 'cancelado' }));

      await service.cancelar(7);

      expect(prisma.sorteo.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { estado: 'cancelado' },
      });
    });

    it('cancelar un sorteo finalizado → BadRequestException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase({ estado: 'finalizado' }));

      await expect(service.cancelar(7)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sorteo inexistente → NotFoundException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.finalizar(7)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.cancelar(7)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── Admin: lotes y códigos ───────────────────────────────────────────────

  describe('crearLote', () => {
    beforeEach(() => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase());
      prisma.sorteoLote.create.mockResolvedValue({ id: 3, sorteoId: 7, cantidad: 50 });
      prisma.sorteoCodigo.createMany.mockResolvedValue({ count: 50 });
    });

    it('genera exactamente la cantidad pedida, con códigos únicos y del alfabeto', async () => {
      const r = await service.crearLote(7, 50, 'jgomez');

      expect(r).toEqual({ id: 3, cantidad: 50 });
      const filas = prisma.sorteoCodigo.createMany.mock.calls[0][0].data;
      expect(filas).toHaveLength(50);
      expect(new Set(filas.map((f: any) => f.codigo)).size).toBe(50);
      for (const f of filas) {
        expect(f.codigo).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
        expect(f.sorteoId).toBe(7);
        expect(f.loteId).toBe(3);
      }
    });

    it('guarda el lote con la cantidad y el usuario que lo generó', async () => {
      await service.crearLote(7, 50, 'jgomez');

      expect(prisma.sorteoLote.create).toHaveBeenCalledWith({
        data: { sorteoId: 7, cantidad: 50, generadoPor: 'jgomez' },
      });
    });

    it('corre dentro de una transacción', async () => {
      await service.crearLote(7, 10, null);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('sorteo inexistente → NotFoundException sin generar nada', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.crearLote(7, 10, null)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.sorteoLote.create).not.toHaveBeenCalled();
    });

    it('colisión de código (P2002) → reintenta el lote completo una vez', async () => {
      prisma.sorteoCodigo.createMany
        .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
        .mockResolvedValueOnce({ count: 10 });

      const r = await service.crearLote(7, 10, null);

      expect(r).toEqual({ id: 3, cantidad: 10 });
      expect(prisma.sorteoCodigo.createMany).toHaveBeenCalledTimes(2);
    });

    it('un error que no es colisión se propaga sin reintentar', async () => {
      prisma.sorteoCodigo.createMany.mockRejectedValue(
        Object.assign(new Error('boom'), { code: 'P1001' }),
      );

      await expect(service.crearLote(7, 10, null)).rejects.toThrow('boom');
      expect(prisma.sorteoCodigo.createMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('listarLotes / buscarLote / codigosDelLote', () => {
    it('agrega el total de códigos y los usados por lote', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase());
      prisma.sorteoLote.findMany.mockResolvedValue([
        { id: 3, sorteoId: 7, cantidad: 100, generadoPor: 'jgomez', _count: { codigos: 100 } },
        { id: 2, sorteoId: 7, cantidad: 50, generadoPor: null, _count: { codigos: 50 } },
      ]);
      prisma.sorteoCodigo.groupBy.mockResolvedValue([{ loteId: 3, _count: { _all: 7 } }]);

      const r = await service.listarLotes(7);

      expect(r[0]).toMatchObject({ id: 3, codigosTotal: 100, codigosUsados: 7 });
      expect(r[1]).toMatchObject({ id: 2, codigosTotal: 50, codigosUsados: 0 });
      expect(r[0]).not.toHaveProperty('_count');
    });

    it('lote que no pertenece al sorteo → NotFoundException', async () => {
      prisma.sorteoLote.findFirst.mockResolvedValue(null);

      await expect(service.buscarLote(7, 3)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.sorteoLote.findFirst).toHaveBeenCalledWith({ where: { id: 3, sorteoId: 7 } });
    });

    it('los códigos del lote se leen por keyset ascendente', async () => {
      prisma.sorteoCodigo.findMany.mockResolvedValue([{ id: 11, codigo: CODIGO }]);

      await service.codigosDelLote(3, 10, 200);

      expect(prisma.sorteoCodigo.findMany).toHaveBeenCalledWith({
        where: { loteId: 3, id: { gt: 10 } },
        orderBy: { id: 'asc' },
        take: 200,
        select: { id: true, codigo: true },
      });
    });
  });

  // ─── Admin: participaciones ───────────────────────────────────────────────

  describe('listarParticipaciones', () => {
    beforeEach(() => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase());
      prisma.sorteoParticipacion.findMany.mockResolvedValue([]);
      prisma.sorteoParticipacion.count.mockResolvedValue(0);
    });

    it('filtra por sorteo y pagina', async () => {
      await service.listarParticipaciones(7, { page: 2, pageSize: 50 });

      expect(prisma.sorteoParticipacion.findMany.mock.calls[0][0]).toMatchObject({
        where: { sorteoId: 7 },
        skip: 50,
        take: 50,
      });
    });

    it('soloGanadores agrega el filtro de ganador', async () => {
      await service.listarParticipaciones(7, { soloGanadores: true });

      expect(prisma.sorteoParticipacion.findMany.mock.calls[0][0].where).toMatchObject({
        sorteoId: 7,
        ganador: true,
      });
    });

    it('search busca por nombre, teléfono, email y código de canje', async () => {
      await service.listarParticipaciones(7, { search: 'juan' });

      const or = prisma.sorteoParticipacion.findMany.mock.calls[0][0].where.OR;
      expect(or).toHaveLength(4);
      expect(or[0]).toEqual({ nombre: { contains: 'juan', mode: 'insensitive' } });
      expect(or[1]).toEqual({ telefono: { contains: 'juan' } });
    });

    it('sorteo inexistente → NotFoundException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.listarParticipaciones(7, {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('exportarParticipacionesCsv', () => {
    function participacionCsv(over: Record<string, unknown> = {}) {
      return {
        id: 900,
        createdAt: new Date('2026-08-15T12:30:00Z'),
        nombre: 'Juan Pérez',
        telefono: '099123456',
        edad: 30,
        email: 'juan@ejemplo.com',
        codigo: { codigo: CODIGO },
        ganador: true,
        codigoCanje: 'ABCD-2345',
        premioEntregado: false,
        premioEntregadoAt: null,
        deviceId: 'dev-1',
        fingerprint: 'fp-abc',
        userAgent: 'Mozilla/5.0',
        ip: '190.64.1.2',
        idioma: 'es-UY',
        plataforma: 'Android',
        resolucion: '412x915',
        ipPais: 'Uruguay',
        ipRegion: 'MO',
        ipCiudad: 'Montevideo',
        gpsLat: null,
        gpsLng: null,
        gpsPais: null,
        gpsDepartamento: null,
        gpsLocalidad: null,
        geoFuente: 'ip',
        ...over,
      };
    }

    beforeEach(() => {
      prisma.sorteo.findUnique.mockResolvedValue(sorteoBase());
      prisma.sorteoParticipacion.findMany.mockResolvedValue([participacionCsv()]);
    });

    it('arranca con BOM y header en español separado por ;', async () => {
      const csv = await service.exportarParticipacionesCsv(7);

      expect(csv.charCodeAt(0)).toBe(0xfeff);
      const header = csv.slice(1).split('\r\n')[0];
      expect(header.split(';')[0]).toBe('Id');
      expect(header).toContain('Teléfono');
      expect(header).toContain('Departamento (GPS)');
    });

    it('escribe las fechas en hora de Montevideo y los booleanos en español', async () => {
      const csv = await service.exportarParticipacionesCsv(7);
      const fila = csv.split('\r\n')[1].split(';');

      expect(fila[1]).toBe('2026-08-15 09:30:00');
      expect(fila[2]).toBe('Juan Pérez');
      expect(fila[7]).toBe('Sí');
      expect(fila[9]).toBe('No');
      expect(fila[10]).toBe('');
    });

    it('escapa separadores, comillas y saltos de línea', async () => {
      prisma.sorteoParticipacion.findMany.mockResolvedValue([
        participacionCsv({ nombre: 'Pérez; Juan "el 9"\nsegunda línea' }),
      ]);

      const csv = await service.exportarParticipacionesCsv(7);

      expect(csv).toContain('"Pérez; Juan ""el 9""\nsegunda línea"');
    });

    it('sorteo inexistente → NotFoundException', async () => {
      prisma.sorteo.findUnique.mockResolvedValue(null);

      await expect(service.exportarParticipacionesCsv(7)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('marcarPremioEntregado', () => {
    it('marca la entrega con la fecha actual', async () => {
      prisma.sorteoParticipacion.findUnique.mockResolvedValue({ id: 900, ganador: true });
      prisma.sorteoParticipacion.update.mockResolvedValue({ id: 900, premioEntregado: true });

      await service.marcarPremioEntregado(900);

      expect(prisma.sorteoParticipacion.update).toHaveBeenCalledWith({
        where: { id: 900 },
        data: { premioEntregado: true, premioEntregadoAt: NOW },
      });
    });

    it('participación inexistente → NotFoundException', async () => {
      prisma.sorteoParticipacion.findUnique.mockResolvedValue(null);

      await expect(service.marcarPremioEntregado(900)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('participación que no ganó → BadRequestException', async () => {
      prisma.sorteoParticipacion.findUnique.mockResolvedValue({ id: 900, ganador: false });

      await expect(service.marcarPremioEntregado(900)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sorteoParticipacion.update).not.toHaveBeenCalled();
    });
  });
});
