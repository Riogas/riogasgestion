import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function crearRes(over: Record<string, unknown> = {}) {
  const res: any = {
    headersSent: false,
    destroyed: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    destroy: jest.fn(),
    ...over,
  };
  return res;
}

function host(res: any): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ url: '/api/sorteos/7/participaciones/export', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('responde el JSON de error con el status de la HttpException', () => {
    const res = crearRes();

    filter.catch(new HttpException('no encontrado', HttpStatus.NOT_FOUND), host(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'no encontrado' }),
    );
  });

  it('un error genérico sale como 500', () => {
    const res = crearRes();

    filter.catch(new Error('boom'), host(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  // Regresión: con headers ya enviados (CSV/ZIP en streaming), status().json()
  // tira ERR_HTTP_HEADERS_SENT y esa excepción adentro del filtro termina en
  // unhandled rejection — que en Node 22 mata el proceso.
  it('con los headers ya enviados no escribe el JSON: corta la conexión', () => {
    const res = crearRes({ headersSent: true });

    filter.catch(new Error('la base se cayó a mitad del export'), host(res));

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.destroy).toHaveBeenCalledTimes(1);
  });

  it('con la response ya destruida no la vuelve a destruir', () => {
    const res = crearRes({ headersSent: true, destroyed: true });

    filter.catch(new Error('boom'), host(res));

    expect(res.destroy).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
