import { Module } from '@nestjs/common';
import { PersonasService } from './personas.service';
import { HogarService } from './hogar.service';
import { PersonasController } from './personas.controller';

@Module({
  controllers: [PersonasController],
  providers: [PersonasService, HogarService],
  exports: [PersonasService, HogarService],
})
export class PersonasModule {}
