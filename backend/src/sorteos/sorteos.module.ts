import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { GeoService } from './geo.service';
import { SorteosAdminController } from './sorteos-admin.controller';
import { SorteosPublicoController } from './sorteos-publico.controller';
import { SorteosService } from './sorteos.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  // SorteosPublicoController va primero: sorteos/publico/* no debe matchear sorteos/:id.
  controllers: [SorteosPublicoController, SorteosAdminController],
  providers: [SorteosService, GeoService],
  exports: [SorteosService],
})
export class SorteosModule {}
