import { HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
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
    exportarParticipacionesCsv: jest
      .fn()
      .mockImplementation(async (_id: number, escribir: (c: string) => void) => {
        await escribir('Id;Nombre\r\n');
      }),
    marcarPremioEntregado: jest.fn().mockResolvedValue({ id: 900 }),
  };
}

function crearResMock() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
  } as unknown as Response & {
    setHeader: jest.Mock;
    send: jest.Mock;
    write: jest.Mock;
    end: jest.Mock;
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

    it('un segundo ZIP mientras hay uno en curso → 429 sin tocar la base', async () => {
      process.env.SORTEOS_PUBLIC_BASE_URL = 'https://goya.riogas.com.uy';
      let liberar!: (codigos: unknown[]) => void;
      service.codigosDelLote.mockImplementationOnce(
        () => new Promise((resolve) => { liberar = resolve as (c: unknown[]) => void; }),
      );

      const primero = controller.zipDelLote(7, 3, crearResStream().res);
      // dejar que el primero tome el semáforo y quede esperando el batch
      await new Promise((r) => setImmediate(r));

      const error = await controller.zipDelLote(7, 3, crearResStream().res).catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(service.codigosDelLote).toHaveBeenCalledTimes(1);

      liberar([]);
      await primero;
    });

    it('terminado el ZIP se libera el semáforo (la descarga siguiente pasa)', async () => {
      process.env.SORTEOS_PUBLIC_BASE_URL = 'https://goya.riogas.com.uy';
      service.codigosDelLote.mockResolvedValue([]);

      await controller.zipDelLote(7, 3, crearResStream().res);
      await controller.zipDelLote(7, 3, crearResStream().res);

      expect(service.codigosDelLote).toHaveBeenCalledTimes(2);
    });

    it('un ZIP que falla también libera el semáforo', async () => {
      process.env.SORTEOS_PUBLIC_BASE_URL = 'https://goya.riogas.com.uy';
      service.codigosDelLote.mockRejectedValueOnce(new Error('base caída'));

      const { res } = crearResStream();
      (res as unknown as { destroy: jest.Mock }).destroy = jest.fn();
      await controller.zipDelLote(7, 3, res);

      service.codigosDelLote.mockResolvedValue([]);
      await expect(controller.zipDelLote(7, 3, crearResStream().res)).resolves.toBeUndefined();
    });

    // Regresión: el release estaba SOLO en el `finally`, así que dependía de que el
    // cuerpo del handler terminara alguna vez. Si el cliente corta la descarga
    // mientras el handler está esperando algo que no vuelve (la base, o el
    // `finalize()` de archiver contra un destino ya destruido), el finally no corre
    // nunca y TODO el backend queda en 429 permanente hasta reiniciarlo.
    it('si el cliente aborta mientras el handler espera, el semáforo se libera igual', async () => {
      process.env.SORTEOS_PUBLIC_BASE_URL = 'https://goya.riogas.com.uy';
      const { res } = crearResStream();
      // La consulta del primer batch nunca vuelve: el handler queda esperando.
      const colgado = controller.zipDelLote(7, 3, res);
      service.codigosDelLote.mockReturnValueOnce(new Promise(() => {}));
      await new Promise((r) => setImmediate(r));

      res.destroy(); // el cliente corta la conexión
      await new Promise((r) => setImmediate(r));

      service.codigosDelLote.mockResolvedValue([]);
      const { res: res2 } = crearResStream();
      await expect(controller.zipDelLote(7, 3, res2)).resolves.toBeUndefined();
      void colgado;
    });

    it('un error de socket (ECONNRESET) también libera el semáforo', async () => {
      process.env.SORTEOS_PUBLIC_BASE_URL = 'https://goya.riogas.com.uy';
      const { res } = crearResStream();
      service.codigosDelLote.mockReturnValueOnce(new Promise(() => {}));

      const colgado = controller.zipDelLote(7, 3, res);
      await new Promise((r) => setImmediate(r)); // el handler ya escucha 'error'
      res.emit('error', new Error('ECONNRESET'));
      await new Promise((r) => setImmediate(r));

      service.codigosDelLote.mockResolvedValue([]);
      const { res: res2 } = crearResStream();
      await expect(controller.zipDelLote(7, 3, res2)).resolves.toBeUndefined();
      void colgado;
    });
  });

  describe('export CSV', () => {
    it('streamea el CSV como adjunto en UTF-8', async () => {
      const res = crearResMock();

      await controller.exportarParticipaciones(7, res);

      expect(service.exportarParticipacionesCsv).toHaveBeenCalledWith(7, expect.any(Function));
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="sorteo-7-participaciones.csv"',
      );
      expect(res.write).toHaveBeenCalledWith('Id;Nombre\r\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('escribe cada chunk sin acumular el CSV entero', async () => {
      service.exportarParticipacionesCsv.mockImplementation(
        async (_id: number, escribir: (c: string) => void) => {
          await escribir('header\r\n');
          await escribir('fila1\r\n');
          await escribir('fila2\r\n');
        },
      );
      const res = crearResMock();

      await controller.exportarParticipaciones(7, res);

      expect(res.write).toHaveBeenCalledTimes(3);
      // los headers se escriben una sola vez, con el primer chunk
      expect(res.setHeader).toHaveBeenCalledTimes(2);
    });

    it('sorteo inexistente: el error sale antes de tocar la response', async () => {
      service.exportarParticipacionesCsv.mockRejectedValue(new Error('sorteo 7 no encontrado'));
      const res = crearResMock();

      await expect(controller.exportarParticipaciones(7, res)).rejects.toThrow('no encontrado');
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });

    // Regresión: si el error aparece DESPUÉS del primer chunk, dejarlo subir hace
    // que el AllExceptionsFilter intente status().json() con headers ya enviados
    // → ERR_HTTP_HEADERS_SENT → unhandled rejection → en Node 22 se cae el proceso.
    it('error después del primer chunk: no propaga, corta la conexión', async () => {
      service.exportarParticipacionesCsv.mockImplementation(
        async (_id: number, escribir: (c: string) => void) => {
          await escribir('header\r\n');
          throw new Error('la base se cayó a mitad del export');
        },
      );
      const res = crearResMock();
      (res as unknown as { destroyed: boolean }).destroyed = false;
      const destroy = jest.fn();
      (res as unknown as { destroy: jest.Mock }).destroy = destroy;

      await expect(controller.exportarParticipaciones(7, res)).resolves.toBeUndefined();

      expect(res.setHeader).toHaveBeenCalledTimes(2);
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(res.end).not.toHaveBeenCalled();
    });

    it('un cliente que corta la descarga a mitad no tumba el handler', async () => {
      service.exportarParticipacionesCsv.mockImplementation(
        async (_id: number, escribir: (c: string) => void) => {
          await escribir('header\r\n');
          await escribir('fila1\r\n');
        },
      );
      const { res } = crearResStream();
      (res as unknown as { write: jest.Mock }).write = jest.fn(() => {
        res.destroy();
        return false;
      });

      await expect(controller.exportarParticipaciones(7, res)).resolves.toBeUndefined();
    });
  });
});
