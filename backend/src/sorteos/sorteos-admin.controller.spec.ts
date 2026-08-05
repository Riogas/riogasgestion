import { InternalServerErrorException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Writable } from 'stream';
import { SorteosAdminController } from './sorteos-admin.controller';
import { SorteosService } from './sorteos.service';

function crearServiceMock() {
  return {
    buscarLote: jest.fn().mockResolvedValue({ id: 3, sorteoId: 7, cantidad: 10 }),
    codigosDelLote: jest.fn().mockResolvedValue([]),
    listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    crear: jest.fn().mockResolvedValue({ id: 7 }),
    detalle: jest.fn().mockResolvedValue({ id: 7 }),
    actualizar: jest.fn().mockResolvedValue({ id: 7 }),
    activar: jest.fn().mockResolvedValue({ id: 7 }),
    finalizar: jest.fn().mockResolvedValue({ id: 7 }),
    cancelar: jest.fn().mockResolvedValue({ id: 7 }),
    crearLote: jest.fn().mockResolvedValue({ id: 3, cantidad: 100 }),
    listarLotes: jest.fn().mockResolvedValue([]),
    listarParticipaciones: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    exportarParticipacionesCsv: jest.fn().mockResolvedValue('Id;Nombre\r\n'),
    marcarPremioEntregado: jest.fn().mockResolvedValue({ id: 900 }),
  };
}

function crearResMock() {
  return { setHeader: jest.fn(), send: jest.fn() } as unknown as Response & {
    setHeader: jest.Mock;
    send: jest.Mock;
  };
}

function requestCon(user?: Record<string, unknown>) {
  return { user } as unknown as Request;
}

/** Response de verdad (Writable) para poder leer el ZIP que sale del archiver. */
function crearResStream() {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    },
  });
  const res = stream as unknown as Response & { setHeader: jest.Mock };
  res.setHeader = jest.fn();
  return { res, contenido: () => Buffer.concat(chunks) };
}

describe('SorteosAdminController', () => {
  let service: ReturnType<typeof crearServiceMock>;
  let controller: SorteosAdminController;

  beforeEach(() => {
    service = crearServiceMock();
    controller = new SorteosAdminController(service as unknown as SorteosService);
  });

  describe('delegación en el service', () => {
    it('listar pasa la query tal cual', async () => {
      await controller.listar({ page: 2, estado: 'activo' });

      expect(service.listar).toHaveBeenCalledWith({ page: 2, estado: 'activo' });
    });

    it('detalle, activar, finalizar y cancelar pasan el id', async () => {
      await controller.detalle(7);
      await controller.activar(7);
      await controller.finalizar(7);
      await controller.cancelar(7);

      expect(service.detalle).toHaveBeenCalledWith(7);
      expect(service.activar).toHaveBeenCalledWith(7);
      expect(service.finalizar).toHaveBeenCalledWith(7);
      expect(service.cancelar).toHaveBeenCalledWith(7);
    });

    it('actualizar pasa id y body', async () => {
      await controller.actualizar(7, { nombre: 'Otro' });

      expect(service.actualizar).toHaveBeenCalledWith(7, { nombre: 'Otro' });
    });

    it('participaciones y entrega delegan con sus parámetros', async () => {
      await controller.listarParticipaciones(7, { soloGanadores: true });
      await controller.marcarPremioEntregado(900);

      expect(service.listarParticipaciones).toHaveBeenCalledWith(7, { soloGanadores: true });
      expect(service.marcarPremioEntregado).toHaveBeenCalledWith(900);
    });
  });

  describe('crearLote — autoría del lote', () => {
    it('usa el sub del JWT', async () => {
      await controller.crearLote(7, { cantidad: 100 }, requestCon({ sub: 'jgomez' }));

      expect(service.crearLote).toHaveBeenCalledWith(7, 100, 'jgomez');
    });

    it('cae en username si no hay sub', async () => {
      await controller.crearLote(7, { cantidad: 100 }, requestCon({ username: 'dmedaglia' }));

      expect(service.crearLote).toHaveBeenCalledWith(7, 100, 'dmedaglia');
    });

    it('sin usuario en la request → null', async () => {
      await controller.crearLote(7, { cantidad: 100 }, requestCon());

      expect(service.crearLote).toHaveBeenCalledWith(7, 100, null);
    });

    it('recorta la identidad al VarChar(80) de la tabla', async () => {
      await controller.crearLote(7, { cantidad: 1 }, requestCon({ sub: 'x'.repeat(200) }));

      expect(service.crearLote.mock.calls[0][2]).toHaveLength(80);
    });
  });

  describe('ZIP del lote', () => {
    const envOriginal = process.env.SORTEOS_PUBLIC_BASE_URL;

    afterEach(() => {
      if (envOriginal === undefined) delete process.env.SORTEOS_PUBLIC_BASE_URL;
      else process.env.SORTEOS_PUBLIC_BASE_URL = envOriginal;
    });

    it('sin SORTEOS_PUBLIC_BASE_URL falla explícito y no escribe headers', async () => {
      delete process.env.SORTEOS_PUBLIC_BASE_URL;
      const res = crearResMock();

      await expect(controller.zipDelLote(7, 3, res)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(service.codigosDelLote).not.toHaveBeenCalled();
    });

    it('valida que el lote sea del sorteo antes de tocar la response', async () => {
      delete process.env.SORTEOS_PUBLIC_BASE_URL;
      service.buscarLote.mockRejectedValue(new Error('lote ajeno'));
      const res = crearResMock();

      await expect(controller.zipDelLote(7, 3, res)).rejects.toThrow('lote ajeno');
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    // Timeout explícito: un QR de 1024px tarda ~6 s adentro del sandbox de jest
    // (en runtime real son ~80 ms), así que va con un solo código.
    it(
      'streamea un ZIP con un PNG por código y los headers de descarga',
      async () => {
        process.env.SORTEOS_PUBLIC_BASE_URL = 'https://goya.riogas.com.uy';
        service.codigosDelLote
          .mockResolvedValueOnce([{ id: 42, codigo: 'ABCD2345EFGH' }])
          .mockResolvedValueOnce([]);

        const { res, contenido } = crearResStream();
        await controller.zipDelLote(7, 3, res);
        const zip = contenido();

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
        expect(res.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename="sorteo-7-lote-3.zip"',
        );
        expect(zip.subarray(0, 2).toString()).toBe('PK');
        expect(zip.toString('latin1')).toContain('ABCD2345EFGH.png');
        // el keyset arranca en 0 y avanza con el último id del batch
        expect(service.codigosDelLote).toHaveBeenNthCalledWith(1, 3, 0, 200);
        expect(service.codigosDelLote).toHaveBeenNthCalledWith(2, 3, 42, 200);
      },
      30_000,
    );
  });

  describe('export CSV', () => {
    it('responde el CSV como adjunto en UTF-8', async () => {
      const res = crearResMock();

      await controller.exportarParticipaciones(7, res);

      expect(service.exportarParticipacionesCsv).toHaveBeenCalledWith(7);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="sorteo-7-participaciones.csv"',
      );
      expect(res.send).toHaveBeenCalledWith('Id;Nombre\r\n');
    });
  });
});
