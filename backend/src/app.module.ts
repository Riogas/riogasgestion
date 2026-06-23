import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { ClientesModule } from './clientes/clientes.module';

@Module({
  imports: [
    // Configuración global desde .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    // PostgreSQL con Prisma (base goya) — módulo global
    PrismaModule,

    // Módulos de la app
    HealthModule,
    ClientesModule,
    // TODO: Agregar módulos a medida que se migran las APIs
    // ZonasModule,
    // UsuariosModule,
    // FleterasModule,
    // AsignacionesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Loguear TODAS las requests
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
