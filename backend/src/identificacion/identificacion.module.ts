import { Module } from '@nestjs/common';
import { PersonasModule } from '../personas/personas.module';
import { CoberturaModule } from '../cobertura/cobertura.module';
import { IdentificacionService } from './identificacion.service';

@Module({
  imports: [PersonasModule, CoberturaModule],
  providers: [IdentificacionService],
  exports: [IdentificacionService],
})
export class IdentificacionModule {}
