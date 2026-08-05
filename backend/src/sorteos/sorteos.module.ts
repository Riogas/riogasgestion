import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { SorteosAdminController } from './sorteos-admin.controller';
import { SorteosService } from './sorteos.service';

@Module({
  controllers: [SorteosAdminController],
  providers: [SorteosService, GeoService],
  exports: [SorteosService],
})
export class SorteosModule {}
