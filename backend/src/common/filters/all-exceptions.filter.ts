import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    // Loguear errores 5xx como error, 4xx como warn
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${status}: ${JSON.stringify(message).substring(0, 200)}`,
      );
    }

    // Respuestas en streaming (CSV/ZIP): si los headers ya salieron, escribir el
    // JSON de error tira ERR_HTTP_HEADERS_SENT y esa excepción, adentro del filtro,
    // termina en unhandled rejection — que en Node 22 mata el proceso. Se corta la
    // conexión: el cliente ve la descarga incompleta y el error ya quedó logueado.
    if (response.headersSent) {
      if (!response.destroyed) response.destroy();
      return;
    }

    response.status(status).json(errorResponse);
  }
}
