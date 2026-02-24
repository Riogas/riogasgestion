import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

/**
 * Interceptor que loguea el tiempo de ejecución de cada handler
 * y el tamaño de la respuesta.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Response');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    const now = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - now;
        const dataSize = data ? JSON.stringify(data).length : 0;

        this.logger.log(
          `${controller}.${handler}() | ${method} ${url} | ${duration}ms | ~${dataSize}b`,
        );

        // Avisar si la respuesta es muy grande
        if (dataSize > 1_000_000) {
          this.logger.warn(
            `⚠️  Respuesta grande: ${controller}.${handler}() devolvió ~${(dataSize / 1024 / 1024).toFixed(1)}MB`,
          );
        }
      }),
    );
  }
}
