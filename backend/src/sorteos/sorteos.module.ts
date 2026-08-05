import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { SorteosService } from './sorteos.service';

@Module({
  providers: [SorteosService, GeoService],
  exports: [SorteosService],
})
export class SorteosModule {}
