import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');

  // Global prefix: /api
  app.setGlobalPrefix('api');

  // Filtro global de excepciones (loguea todo)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Interceptor global de logging (tiempo + tamaño respuesta)
  app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS — permitir frontend
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4000',
      process.env.FRONTEND_URL || 'http://localhost:3000',
    ],
    credentials: true,
  });

  // Validación global con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger — APAGADO salvo que se pida explícitamente con SWAGGER_ENABLED=1.
  //
  // Antes la condición era `NODE_ENV !== 'production'`, y backend/.env fija
  // NODE_ENV=development: en los hechos /api/docs y /api/docs-json servían el
  // catálogo COMPLETO sin autenticación ninguna. SwaggerModule.setup() registra
  // las rutas sobre el http adapter de Express, o sea que queda FUERA del
  // pipeline de guards de Nest: ningún @UseGuards(AuthGuard) lo cubre.
  //
  // La variable propia y explícita evita que un ambiente quede expuesto por
  // arrastre de NODE_ENV. Para leer el catálogo está el portal /dashboard/docs,
  // que sí pasa por el gate root (src/lib/docs/root-guard.ts).
  if (process.env.SWAGGER_ENABLED === '1') {
    const config = new DocumentBuilder()
      .setTitle('Riogas Gestión API')
      .setDescription('API Backend para el sistema de gestión Riogas')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addTag('health', 'Health check')
      .addTag('clientes', 'Gestión de clientes')
      .addTag('zonas', 'Gestión de zonas')
      .addTag('usuarios', 'Gestión de usuarios')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('📚 Swagger disponible en /api/docs');
  }

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Backend escuchando en http://0.0.0.0:${port}`);
  logger.log(`📡 Modo: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
