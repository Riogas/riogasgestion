import { Module } from '@nestjs/common';
import { PersonasModule } from '../personas/personas.module';
import { CoberturaModule } from '../cobertura/cobertura.module';
import { IdentificacionService } from './identificacion.service';
import { IdentificacionController } from './identificacion.controller';

@Module({
  imports: [PersonasModule, CoberturaModule],
  controllers: [IdentificacionController],
  providers: [IdentificacionService],
  exports: [IdentificacionService],
})
export class IdentificacionModule {}
