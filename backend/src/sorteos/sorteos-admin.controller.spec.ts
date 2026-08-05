import type { Request, Response } from 'express';
import { SorteosAdminController } from './sorteos-admin.controller';
import { SorteosService } from './sorteos.service';

// El endpoint del ZIP no se testea acá: archiver 8 es ESM puro y no se puede
// cargar desde el runtime CommonJS de jest (se cubre con smoke sobre dist/).
function crearServiceMock() {
  return {
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
