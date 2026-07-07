import { IdentificacionController } from './identificacion.controller';
import { IdentificacionService } from './identificacion.service';

describe('IdentificacionController', () => {
  let service: { identificar: jest.Mock };
  let controller: IdentificacionController;

  beforeEach(() => {
    service = { identificar: jest.fn().mockResolvedValue({ resultado: 'SIN_MATCH' }) };
    controller = new IdentificacionController(service as unknown as IdentificacionService);
  });

  it('C1: rol ausente en el JWT nunca cae en CALL_CENTER (fail-closed a DISTRIBUIDOR)', async () => {
    await controller.identificar(
      { identificador: '12345678', tipo: 'CEDULA' },
      { user: {} },
    );

    expect(service.identificar).toHaveBeenCalledWith(
      expect.objectContaining({ rol: 'DISTRIBUIDOR' }),
    );
  });

  it('C1: rol desconocido/no reconocido en el JWT tampoco cae en CALL_CENTER', async () => {
    await controller.identificar(
      { identificador: '12345678', tipo: 'CEDULA' },
      { user: { rol: 'ADMIN' as unknown as 'CALL_CENTER' } },
    );

    expect(service.identificar).toHaveBeenCalledWith(
      expect.objectContaining({ rol: 'DISTRIBUIDOR' }),
    );
  });

  it('C1: sin req.user tampoco cae en CALL_CENTER', async () => {
    await controller.identificar({ identificador: '12345678', tipo: 'CEDULA' }, {});

    expect(service.identificar).toHaveBeenCalledWith(
      expect.objectContaining({ rol: 'DISTRIBUIDOR' }),
    );
  });

  it('CALL_CENTER explícito en el JWT sí se respeta', async () => {
    await controller.identificar(
      { identificador: '12345678', tipo: 'CEDULA' },
      { user: { rol: 'CALL_CENTER' } },
    );

    expect(service.identificar).toHaveBeenCalledWith(
      expect.objectContaining({ rol: 'CALL_CENTER' }),
    );
  });

  it('normaliza empresaFleteraId a number', async () => {
    await controller.identificar(
      { identificador: '12345678', tipo: 'CEDULA' },
      { user: { rol: 'CALL_CENTER', empresaFleteraId: '100' as unknown as number } },
    );

    expect(service.identificar).toHaveBeenCalledWith(
      expect.objectContaining({ empresaFleteraId: 100 }),
    );
  });
});
