import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '-';
    const startTime = Date.now();

    // Log de entrada
    this.logger.log(
      `→ ${method} ${originalUrl} | IP: ${ip} | UA: ${userAgent.substring(0, 80)}`,
    );

    // Log de body en POST/PUT/PATCH (solo en debug)
    if (
      process.env.DEBUG_API === '1' &&
      ['POST', 'PUT', 'PATCH'].includes(method) &&
      req.body
    ) {
      const bodyPreview = JSON.stringify(req.body).substring(0, 500);
      this.logger.debug(`   Body: ${bodyPreview}`);
    }

    // Interceptar el fin de la respuesta
    const originalSend = res.send;
    let responseBody: string | undefined;

    res.send = function (body: any) {
      responseBody = typeof body === 'string' ? body : undefined;
      return originalSend.call(this, body);
    };

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '-';

      // Color según status code
      const statusEmoji =
        statusCode >= 500
          ? '🔴'
          : statusCode >= 400
            ? '🟡'
            : statusCode >= 300
              ? '🔵'
              : '🟢';

      this.logger.log(
        `← ${statusEmoji} ${method} ${originalUrl} ${statusCode} | ${duration}ms | ${contentLength}b`,
      );

      // En errores 4xx/5xx, loguear preview del body de respuesta
      if (
        process.env.DEBUG_API === '1' &&
        statusCode >= 400 &&
        responseBody
      ) {
        this.logger.warn(
          `   Error body: ${responseBody.substring(0, 300)}`,
        );
      }
    });

    next();
  }
}
