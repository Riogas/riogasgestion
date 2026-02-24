import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Configuración global desde .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    // PostgreSQL con TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'riogas'),
        password: config.get<string>('DB_PASSWORD', 'riogas'),
        database: config.get<string>('DB_DATABASE', 'riogas_gestion'),
        autoLoadEntities: true,
        // En dev: sincronizar esquema automáticamente (NO usar en producción)
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('DB_LOGGING', 'false') === 'true',
        // Pool de conexiones
        extra: {
          max: config.get<number>('DB_POOL_MAX', 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),

    // Módulos de la app
    HealthModule,
    // TODO: Agregar módulos a medida que se migran las APIs
    // ClientesModule,
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
