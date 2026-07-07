import { Module } from '@nestjs/common';
import { CoberturaService } from './cobertura.service';

@Module({
  providers: [CoberturaService],
  exports: [CoberturaService],
})
export class CoberturaModule {}
