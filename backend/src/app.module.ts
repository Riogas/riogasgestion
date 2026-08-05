import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { ClientesModule } from './clientes/clientes.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { MovilesModule } from './moviles/moviles.module';
import { FleterasModule } from './fleteras/fleteras.module';
import { ZonasModule } from './zonas/zonas.module';
import { PersonasModule } from './personas/personas.module';
import { WorkbenchModule } from './workbench/workbench.module';
import { CoberturaModule } from './cobertura/cobertura.module';
import { IdentificacionModule } from './identificacion/identificacion.module';
import { SorteosModule } from './sorteos/sorteos.module';

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
    CatalogosModule,
    MovilesModule,
    FleterasModule,
    ZonasModule,
    PersonasModule,
    WorkbenchModule,
    CoberturaModule,
    IdentificacionModule,
    SorteosModule,
    // TODO: Agregar módulos a medida que se migran las APIs
    // UsuariosModule,
    // AsignacionesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Loguear TODAS las requests
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
