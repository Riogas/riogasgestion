import { Module } from '@nestjs/common';
import { SorteosService } from './sorteos.service';

@Module({
  providers: [SorteosService],
  exports: [SorteosService],
})
export class SorteosModule {}
